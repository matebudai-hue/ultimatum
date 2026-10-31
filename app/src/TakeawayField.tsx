import React from 'react';
export function TakeawayField({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
 return <section className="takeaway-field"><h2>Mit viszel magaddal ebből a játékból?</h2><p>Mi lepett meg? Mi maradt benned? Mit vettél észre magadon?</p><label className="field"><span>Saját benyomásaim, tanulságaim</span><textarea value={value} onChange={event=>onChange(event.target.value)} maxLength={2000} rows={6} disabled={disabled}/></label><small>{value.length}/2000 karakter · Nem kötelező. A tréner a kivezetés során megjelenítheti ezt a gondolatot.</small></section>;
}
