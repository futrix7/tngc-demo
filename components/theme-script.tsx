"use client"

import { useEffect } from "react"

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme')||'system';var r=t==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.classList.add(r)}catch(e){}})();`

export function ThemeScript() {
  useEffect(() => {
    const s = document.createElement("script")
    s.textContent = THEME_SCRIPT
    document.head.appendChild(s)
    return () => { document.head.removeChild(s) }
  }, [])

  return null
}
