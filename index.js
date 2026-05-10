import { AppRegistry } from "react-native"
import App from "./App"

/**
 * Doit correspondre à `getMainComponentName()` côté Android (`MainActivity`) : `"main"`.
 * Voir aussi `app.json` → champ racine `"name": "main"`.
 */
AppRegistry.registerComponent("main", () => App)
