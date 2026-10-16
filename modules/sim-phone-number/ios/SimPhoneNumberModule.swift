import ExpoModulesCore

public class SimPhoneNumberModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SimPhoneNumber")

    Function("hello") {
      return "Hello world! 👋"
    }
  }
}
