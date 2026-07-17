import Foundation

struct APIConfiguration: Sendable {
    let baseURL: URL

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
    case server(status: Int, code: String?, message: String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Respuesta inválida del servidor."
        case .unauthorized: "La sesión ha caducado."
        case .server(_, _, let message): message
        case .decoding: "No se pudieron interpretar los datos."
        }
    }
}

actor APIClient {
    typealias TokenProvider = @Sendable () async -> String?

    private let configuration: APIConfiguration
    private let session: URLSession
    private let tokenProvider: TokenProvider
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(configuration: APIConfiguration, session: URLSession = .shared, tokenProvider: @escaping TokenProvider) {
        self.configuration = configuration
        self.session = session
        self.tokenProvider = tokenProvider
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
    }

    func get<Response: Decodable & Sendable>(_ path: String, query: [URLQueryItem] = []) async throws -> Response {
        try await request(path, method: .get, query: query, body: Optional<EmptyBody>.none)
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
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = await tokenProvider() { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let idempotencyKey { request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key") }
        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw APIError.invalidResponse }
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
        catch { throw APIError.decoding(String(describing: error)) }
    }
}

private struct EmptyBody: Encodable {}
struct EmptyResponse: Codable, Sendable { init() {} }
