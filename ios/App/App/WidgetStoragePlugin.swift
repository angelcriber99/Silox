import Foundation
import Capacitor

@objc(WidgetStoragePlugin)
public class WidgetStoragePlugin: CAPPlugin {
    
    @objc func saveToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Token must be provided")
            return
        }
        
        let defaults = UserDefaults(suiteName: "group.com.angelcriber.silox")
        defaults?.set(token, forKey: "supabase_token")
        
        call.resolve([
            "success": true
        ])
    }
}
