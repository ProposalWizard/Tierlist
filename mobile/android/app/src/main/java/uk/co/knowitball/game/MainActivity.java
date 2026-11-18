package uk.co.knowitball.game;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * A game, not a web page: the clock / battery bar at the top AND the back /
 * home buttons at the bottom are hidden, so the game has the whole screen
 * (Mikey, 11 and 13 Nov 2026). A flick from the top or bottom edge shows them
 * for a moment, see-through over the game, as in other full-screen apps.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideTopBar();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideTopBar();
    }

    private void hideTopBar() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.setAppearanceLightNavigationBars(false);
        c.setAppearanceLightStatusBars(false);
        getWindow().setNavigationBarColor(0xFF0B100E);
        getWindow().getDecorView().setBackgroundColor(0xFF0B100E);
    }
}
