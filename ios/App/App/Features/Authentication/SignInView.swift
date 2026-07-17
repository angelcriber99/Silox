import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @EnvironmentObject private var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var isGoogleLoading = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 10) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .font(.system(size: 46, weight: .semibold))
                            .foregroundStyle(SiloxColors.accent)
                        Text("Silox").font(.largeTitle.bold())
                        Text("Tu cartera de inversión, nativa y privada.").foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
                Section("Acceso") {
                    Button {
                        Task {
                            isGoogleLoading = true
                            await session.signInWithGoogle()
                            isGoogleLoading = false
                        }
                    } label: {
                        if isGoogleLoading { ProgressView().frame(maxWidth: .infinity) }
                        else { Label("Continuar con Google", systemImage: "person.crop.circle.badge.checkmark").frame(maxWidth: .infinity) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isLoading || isGoogleLoading)

                    Text("O usa tu correo").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                    TextField("Correo electrónico", text: $email)
                        .textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    SecureField("Contraseña", text: $password).textContentType(.password)
                    Button {
                        Task {
                            isLoading = true
                            await session.signIn(email: email, password: password)
                            isLoading = false
                        }
                    } label: {
                        if isLoading { ProgressView().frame(maxWidth: .infinity) }
                        else { Text("Entrar").frame(maxWidth: .infinity) }
                    }
                    .siloxProminentButtonStyle()
                    .disabled(email.isEmpty || password.isEmpty || isLoading || isGoogleLoading)
                }
                if let message = session.errorMessage {
                    Section { Text(message).foregroundStyle(.red).font(.footnote) }
                }
                Section {
                    Text("La sesión se cifra en Keychain y se renueva automáticamente. Silox no almacena tu contraseña.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Iniciar sesión")
        }
    }
}
