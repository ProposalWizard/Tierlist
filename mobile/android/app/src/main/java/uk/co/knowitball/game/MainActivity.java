package uk.co.knowitball.game;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * A game, not a web page: the clock / battery bar at the top is hidden (swipe
 * down from the top to see it for a moment), like other football games
 * (Mikey, 11 Nov 2026). The back / home buttons at the bottom stay, dark.
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
        c.hide(WindowInsetsCompat.Type.statusBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.setAppearanceLightNavigationBars(false);
        c.setAppearanceLightStatusBars(false);
        getWindow().setNavigationBarColor(0xFF0B100E);
        getWindow().getDecorView().setBackgroundColor(0xFF0B100E);
    }
}
