import { registerRootComponent } from 'expo';
import Boot from './src/Boot';

// Boot loads the phone settings (src/appFlags.ts) and then the game, and shows
// any fault on screen instead of closing the app.
registerRootComponent(Boot);
