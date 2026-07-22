import Foundation
import MetricKit
import os

struct APIConfiguration: Sendable {
    let baseURL: URL
    let requestTimeout: TimeInterval

    init(baseURL: URL, requestTimeout: TimeInterval = 30) {
        self.baseURL = baseURL
        self.requestTimeout = requestTimeout
    }

    static var fromBundle: APIConfiguration {
        let raw = Bundle.main.object(forInfoDictionaryKey: "SILOX_API_BASE_URL") as? String
        return APIConfiguration(baseURL: URL(string: raw ?? "https://example.invalid")!)
    }
}

enum HTTPMethod: String { case get = "GET", post = "POST", put = "PUT", patch = "PATCH", delete = "DELETE" }

struct APIErrorEnvelope: Decodable {
    struct Details: Decodable {
        let code: String?
        let message: String?
    }
    let error: Details?
    let requestId: String?
}

private struct APIDataEnvelope<Value: Decodable>: Decodable { let data: Value }

enum APIError: LocalizedError, Equatable {
    case invalidResponse
    case unauthorized
    case timedOut
    case transport(String)
    case server(status: Int, code: String?, message: String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Respuesta inválida del servidor."
        case .unauthorized: "La sesión ha caducado."
        case .timedOut: "La solicitud ha tardado demasiado."
        case .transport: "No se pudo conectar con el servidor."
        case .server(_, _, let message): message
        case .decoding: "No se pudieron interpretar los datos."
        }
    }
}

actor APIClient {
    typealias TokenProvider = @Sendable (_ forceRefresh: Bool) async -> String?

    private let configuration: APIConfiguration
    private let session: URLSession
    private let tokenProvider: TokenProvider
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let logger = Logger(subsystem: "com.angelcriber.silox", category: "APIClient")
    private let signposter = OSSignposter(subsystem: "com.angelcriber.silox", category: "APIClient")
    private var refreshIntervals: [String: TimeInterval] = [:]

    init(configuration: APIConfiguration, session: URLSession = .shared, tokenProvider: @escaping TokenProvider) {
        self.configuration = configuration
        self.session = session
        self.tokenProvider = tokenProvider
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
    }

    init(
        configuration: APIConfiguration,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () async -> String?
    ) {
        self.init(configuration: configuration, session: session, tokenProvider: { _ in await tokenProvider() })
    }

    func get<Response: Decodable & Sendable>(_ path: String, query: [URLQueryItem] = []) async throws -> Response {
        try await request(path, method: .get, query: query, body: Optional<EmptyBody>.none)
    }

    func recommendedRefreshInterval(for path: String, fallback: TimeInterval) -> TimeInterval {
        refreshIntervals[path] ?? fallback
    }

    func send<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        method: HTTPMethod,
        body: Body,
        idempotencyKey: String? = nil
    ) async throws -> Response {
        try await request(path, method: method, query: [], body: body, idempotencyKey: idempotencyKey)
    }

    func sendRaw<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        method: HTTPMethod,
        body: Body
    ) async throws -> Response {
        try await request(path, method: method, query: [], body: body, unwrapEnvelope: false)
    }

    func delete(_ path: String, idempotencyKey: String? = nil) async throws {
        let _: EmptyResponse = try await request(
            path,
            method: .delete,
            query: [],
            body: Optional<EmptyBody>.none,
            idempotencyKey: idempotencyKey
        )
    }

    func upload<Response: Decodable & Sendable>(
        _ path: String,
        fileData: Data,
        fileName: String,
        mimeType: String = "text/csv",
        unwrapEnvelope: Bool = true
    ) async throws -> Response {
        let boundary = "Silox-\(UUID().uuidString)"
        let safeFileName = fileName
            .replacingOccurrences(of: "\"", with: "_")
            .replacingOccurrences(of: "\r", with: "_")
            .replacingOccurrences(of: "\n", with: "_")
        var body = Data()
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"file\"; filename=\"\(safeFileName)\"\r\n".utf8))
        body.append(Data("Content-Type: \(mimeType)\r\n\r\n".utf8))
        body.append(fileData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))

        let url = configuration.baseURL.appending(path: path)
        return try await perform(
            url: url,
            method: .post,
            encodedBody: body,
            contentType: "multipart/form-data; boundary=\(boundary)",
            idempotencyKey: nil,
            allowsUnauthorizedRetry: true,
            unwrapEnvelope: unwrapEnvelope
        )
    }

    private func request<Body: Encodable, Response: Decodable>(
        _ path: String,
        method: HTTPMethod,
        query: [URLQueryItem],
        body: Body?,
        idempotencyKey: String? = nil,
        unwrapEnvelope: Bool = true
    ) async throws -> Response {
        var components = URLComponents(url: configuration.baseURL.appending(path: path), resolvingAgainstBaseURL: false)
        if !query.isEmpty { components?.queryItems = query }
        guard let url = components?.url else { throw APIError.invalidResponse }
        let encodedBody = try body.map { try encoder.encode($0) }
        return try await perform(
            url: url,
            method: method,
            encodedBody: encodedBody,
            contentType: encodedBody == nil ? nil : "application/json",
            idempotencyKey: idempotencyKey,
            allowsUnauthorizedRetry: method.isIdempotent || idempotencyKey != nil,
            unwrapEnvelope: unwrapEnvelope
        )
    }

    private func perform<Response: Decodable>(
        url: URL,
        method: HTTPMethod,
        encodedBody: Data?,
        contentType: String?,
        idempotencyKey: String?,
        allowsUnauthorizedRetry: Bool,
        unwrapEnvelope: Bool
    ) async throws -> Response {
        let startedAt = Date()
        let interval = signposter.beginInterval("API request")
        defer { signposter.endInterval("API request", interval) }
        var forceRefresh = false
        var authorizationRefreshAttempted = false
        var transientRetries = 0
        let canRetry = method.isIdempotent || idempotencyKey != nil

        while true {
            logger.debug("request method=\(method.rawValue, privacy: .public) path=\(url.path, privacy: .public) retry=\(transientRetries)")
            var request = URLRequest(url: url, timeoutInterval: configuration.requestTimeout)
            request.httpMethod = method.rawValue
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            if let token = await tokenProvider(forceRefresh) {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            if let idempotencyKey { request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key") }
            if let encodedBody {
                request.httpBody = encodedBody
                request.setValue(contentType, forHTTPHeaderField: "Content-Type")
            }

            let data: Data
            let response: URLResponse
            do {
                (data, response) = try await session.data(for: request)
            } catch is CancellationError {
                logger.debug("cancelled method=\(method.rawValue, privacy: .public) path=\(url.path, privacy: .public)")
                throw CancellationError()
            } catch let error as URLError where error.code == .cancelled {
                logger.debug("cancelled method=\(method.rawValue, privacy: .public) path=\(url.path, privacy: .public)")
                throw CancellationError()
            } catch let error as URLError where error.code == .timedOut {
                logger.error("timeout method=\(method.rawValue, privacy: .public) path=\(url.path, privacy: .public)")
                if canRetry, transientRetries < 2 {
                    transientRetries += 1
                    try await retryDelay(attempt: transientRetries)
                    continue
                }
                throw APIError.timedOut
            } catch {
                logger.error("transport_error method=\(method.rawValue, privacy: .public) path=\(url.path, privacy: .public)")
                if canRetry, transientRetries < 2 {
                    transientRetries += 1
                    try await retryDelay(attempt: transientRetries)
                    continue
                }
                throw APIError.transport(String(describing: error))
            }

            guard let httpResponse = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            if httpResponse.statusCode == 401, !authorizationRefreshAttempted, allowsUnauthorizedRetry {
                logger.notice("retry_after_401 method=\(method.rawValue, privacy: .public) path=\(url.path, privacy: .public)")
                authorizationRefreshAttempted = true
                forceRefresh = true
                continue
            }
            if canRetry, httpResponse.statusCode.isTransient, transientRetries < 2 {
                transientRetries += 1
                try await retryDelay(
                    attempt: transientRetries,
                    retryAfter: httpResponse.value(forHTTPHeaderField: "Retry-After")
                )
                continue
            }
            captureRefreshInterval(from: httpResponse, path: url.path)
            let durationMilliseconds = Date().timeIntervalSince(startedAt) * 1_000
            logger.info("response method=\(method.rawValue, privacy: .public) path=\(url.path, privacy: .public) status=\(httpResponse.statusCode) duration_ms=\(durationMilliseconds, format: .fixed(precision: 2))")
            return try decode(data: data, response: httpResponse, unwrapEnvelope: unwrapEnvelope)
        }
    }

    private func captureRefreshInterval(from response: HTTPURLResponse, path: String) {
        guard let raw = response.value(forHTTPHeaderField: "x-silox-refresh-after"),
              let seconds = TimeInterval(raw) else { return }
        refreshIntervals[path] = min(300, max(3, seconds))
    }

    private func retryDelay(attempt: Int, retryAfter: String? = nil) async throws {
        let serverDelay = retryAfter.flatMap(TimeInterval.init).map { min(5, max(0, $0)) }
        let seconds = serverDelay ?? (attempt == 1 ? 0.35 : 0.8)
        try await Task.sleep(for: .seconds(seconds))
    }

    private func decode<Response: Decodable>(
        data: Data,
        response: HTTPURLResponse,
        unwrapEnvelope: Bool
    ) throws -> Response {
        if response.statusCode == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(response.statusCode) else {
            let envelope = try? decoder.decode(APIErrorEnvelope.self, from: data)
            throw APIError.server(
                status: response.statusCode,
                code: envelope?.error?.code,
                message: envelope?.error?.message ?? "Error del servidor (\(response.statusCode))."
            )
        }
        if Response.self == EmptyResponse.self { return EmptyResponse() as! Response }
        do {
            if unwrapEnvelope { return try decoder.decode(APIDataEnvelope<Response>.self, from: data).data }
            return try decoder.decode(Response.self, from: data)
        }
        catch {
            logger.error("decoding_error status=\(response.statusCode)")
            throw APIError.decoding(String(describing: error))
        }
    }
}

private extension HTTPMethod {
    var isIdempotent: Bool {
        switch self {
        case .get, .put, .delete: true
        case .post, .patch: false
        }
    }
}

private extension Int {
    var isTransient: Bool { self == 429 || self == 502 || self == 503 || self == 504 }
}

private struct EmptyBody: Encodable {}
struct EmptyResponse: Codable, Sendable { init() {} }

/// Opt-in MetricKit bridge. The app lifecycle can call `start()` and `stop()`
/// when telemetry policy is decided; constructing it has no side effects.
final class PerformanceMonitor: NSObject, MXMetricManagerSubscriber {
    private let logger = Logger(subsystem: "com.angelcriber.silox", category: "MetricKit")
    private var isStarted = false

    func start() {
        guard !isStarted else { return }
        isStarted = true
        MXMetricManager.shared.add(self)
        logger.info("MetricKit monitor started")
    }

    func stop() {
        guard isStarted else { return }
        isStarted = false
        MXMetricManager.shared.remove(self)
        logger.info("MetricKit monitor stopped")
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        logger.info("MetricKit metric payloads=\(payloads.count)")
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        logger.notice("MetricKit diagnostic payloads=\(payloads.count)")
    }
}
