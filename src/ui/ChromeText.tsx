import {useId} from 'react'
/** SVG keeps opaque glyph fills intact while parent countdown transforms animate. */
export function ChromeText({children}:{children:string|number}){
 const text=String(children),id='chrome-'+useId().replace(/[^a-zA-Z0-9_-]/g,''),units=[...text].reduce((n,c)=>n+(/[!1I]/.test(c)?.38:/[MW]/.test(c)?.95:c===' '?.35:.76),0),width=units*100+16
 return <span className="pp-chrome-text"><svg aria-hidden="true" viewBox={`0 0 ${width} 118`} style={{width:`${units+.16}em`,height:'1.18em'}}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff"/><stop offset=".22" stopColor="#bcf8ff"/><stop offset=".43" stopColor="#70b8ee"/><stop offset=".49" stopColor="#627dbd"/><stop offset=".52" stopColor="#d575d9"/><stop offset=".75" stopColor="#b386eb"/><stop offset="1" stopColor="#fff0ff"/></linearGradient></defs><text x="8" y="94" fontSize="100" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontStyle="italic" textLength={units*100} lengthAdjust="spacingAndGlyphs" fill={`url(#${id})`} stroke="#e7faff" strokeWidth="1.7" paintOrder="stroke fill">{text}</text></svg><span className="pp-sr-only">{text}</span></span>
}
