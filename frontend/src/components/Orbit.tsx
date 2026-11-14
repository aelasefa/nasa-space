export function Orbit({ active = false }: { active?: boolean }) {
  return <svg className={active ? 'orbit active' : 'orbit'} viewBox="0 0 600 370" role="img" aria-label="Schematic of the lunar orbiter passing over the south pole">
    <defs>
      <radialGradient id="moon" cx="31%" cy="27%" r="78%">
        <stop stopColor="#c9d5d9"/><stop offset=".54" stopColor="#697d87"/><stop offset="1" stopColor="#222e3c"/>
      </radialGradient>
      <clipPath id="moon-edge"><circle cx="295" cy="175" r="106"/></clipPath>
    </defs>
    <path d="M35 175H565M295 23V329" stroke="#394d5e" strokeDasharray="4 8"/>
    <ellipse cx="295" cy="175" rx="192" ry="92" transform="rotate(-23 295 175)" fill="none" stroke="#537180" strokeDasharray="5 6"/>
    <circle cx="295" cy="175" r="106" fill="url(#moon)"/>
    <g clipPath="url(#moon-edge)" opacity=".45">
      <path d="M184 173Q228 116 271 134T398 129M189 203Q233 173 280 202T399 180M202 230Q249 216 304 242T392 225" fill="none" stroke="#859da8" strokeWidth="4"/>
      <ellipse cx="261" cy="146" rx="27" ry="17" fill="#51646f"/>
      <ellipse cx="326" cy="204" rx="38" ry="25" fill="#3a515e"/>
      <circle cx="226" cy="193" r="13" fill="#637b87"/>
      <circle cx="335" cy="108" r="16" fill="#889ba2"/>
    </g>
    <path d="M119 245C147 290 284 264 389 210C451 179 491 138 477 104" stroke="#94ced1" strokeWidth="1.5" fill="none"/>
    <circle className="orbiter" cx="428" cy="187" r="5" fill="#b7f0e7"/>
    <path d="M295 278L316 313H420" fill="none" stroke="#7b9ca6"/>
    <circle cx="295" cy="278" r="4" fill="#b7f0e7"/>
    <text x="324" y="333" fill="#a9c4ce" fontSize="12">SOUTH POLE</text>
  </svg>
}
