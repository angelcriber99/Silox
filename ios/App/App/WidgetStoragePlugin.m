#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WidgetStoragePlugin, "WidgetStoragePlugin",
    CAP_PLUGIN_METHOD(saveToken, CAPPluginReturnPromise);
)
