import { registerWebModule, NativeModule } from 'expo';

class SimPhoneNumberModule extends NativeModule<{}> {
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(SimPhoneNumberModule, 'SimPhoneNumberModule');
