// Stand-in for "react" in twin tests: this cloud copy has no node_modules,
// and game logic only imports hooks for screen helpers the tests never call.
module.exports = { useState: (v) => [v, () => {}], useEffect: () => {}, useMemo: (f) => f(), useCallback: (f) => f, useRef: (v) => ({ current: v }) };
