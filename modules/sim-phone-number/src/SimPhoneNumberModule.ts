import { NativeModule, requireOptionalNativeModule } from "expo";

declare class SimPhoneNumberModule extends NativeModule {
  getPhoneNumber(): string | null;
}

// Expo Go and builds created before this module was added cannot load it.
export default requireOptionalNativeModule<SimPhoneNumberModule>("SimPhoneNumber");
