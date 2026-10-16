import { NativeModule, requireNativeModule } from "expo";

declare class SimPhoneNumberModule extends NativeModule {
  getPhoneNumber(): string | null;
}

export default requireNativeModule<SimPhoneNumberModule>("SimPhoneNumber");
