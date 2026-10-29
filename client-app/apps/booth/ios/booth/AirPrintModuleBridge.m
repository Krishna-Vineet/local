#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AirPrintModule, NSObject)

RCT_EXTERN_METHOD(print:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
