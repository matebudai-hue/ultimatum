// All prices, variants and placement rules live here; existing product ids stay stable.
export const categories=[['seat','Ülőhelyek'],['surface','Asztalok'],['tools','Tréneri eszközök'],['comfort','Kényelem'],['mood','Hangulat'],['personal','Saját részletek'],['play','Plüssök és játékok']];
export const tones={theme:{name:'A terem színe',value:null},teal:{name:'Türkiz',value:'#32959a'},navy:{name:'Éjkék',value:'#355b78'},mustard:{name:'Mustár',value:'#d6a344'},terracotta:{name:'Terrakotta',value:'#bd7560'},sage:{name:'Zsálya',value:'#8caa8b'},cream:{name:'Krém',value:'#e7ddc7'},graphite:{name:'Grafit',value:'#555f68'},rose:{name:'Mályva',value:'#b78e9f'}};
Object.assign(tones,{white:{name:'Fehér',value:'#f5f5f0'},black:{name:'Fekete',value:'#24282d'},red:{name:'Piros',value:'#c94b4b'},coral:{name:'Korall',value:'#ed8878'},orange:{name:'Narancs',value:'#e79c43'},yellow:{name:'Napsárga',value:'#f0cd50'},lime:{name:'Lime',value:'#b1c85c'},emerald:{name:'Smaragd',value:'#31816a'},forest:{name:'Erdőzöld',value:'#345b43'},mint:{name:'Menta',value:'#a4d8c2'},cyan:{name:'Élénk türkiz',value:'#28b9c6'},sky:{name:'Égkék',value:'#8ebee3'},cobalt:{name:'Királykék',value:'#3d5bb5'},purple:{name:'Lila',value:'#8063a6'},lavender:{name:'Levendula',value:'#b6a5d3'},pink:{name:'Rózsaszín',value:'#e8a3bd'}});
export const validTone=t=>Object.hasOwn(tones,t)||typeof t==='string'&&/^#[0-9a-f]{6}$/i.test(t);
export const toneColor=(tone,fallback='#32959a')=>tones[tone]?.value||(/^#[0-9a-f]{6}$/i.test(tone)?tone:fallback);
export const themes={ice:{name:'Jégtörő',accent:'#32959a',wall:'#c4e0e3',floor:'oak'},workshop:{name:'Műhely',accent:'#d6a344',wall:'#cbd2d5',floor:'concrete'},living:{name:'Nappali',accent:'#bd7560',wall:'#e4d4bf',floor:'walnut'},minimal:{name:'Letisztult',accent:'#555f68',wall:'#e8e9e5',floor:'light'}};
export const walls={ice:{name:'Jégkék',value:'#c4e0e3'},sand:{name:'Homok',value:'#e4d4bf'},white:{name:'Törtfehér',value:'#e8e9e5'},sage:{name:'Zsálya',value:'#c6d3c1'},slate:{name:'Palaszürke',value:'#b8c4cb'}};
export const floors={oak:{name:'Világos tölgy',value:'#dbc5a2'},walnut:{name:'Dió',value:'#a98569'},light:{name:'Világos padló',value:'#ece8dd'},concrete:{name:'Beton',value:'#cdd2d1'}};
export const views={water:'Vízpart',garden:'Kert',forest:'Erdő',city:'Város'};
const data=[
['chair','Tréningszék','seat',15,12,1.4,1.4,'furniture','chair',['Egyszerű','Párnázott','Prémium kárpit'],[20,35]],
['armchair','Karosszék','seat',45,4,2,2,'furniture','armchair',['Kényelmes','Puha kárpit','Lounge'],[35,60]],
['cushion','Ülőpárna','seat',15,8,1.4,1.4,'furniture','cushion',['Pamut','Vastag párna','Szövött huzat'],[15,25]],
['beanbag','Babzsák','seat',35,4,2,2,'furniture','beanbag',['Klasszikus','Nagy babzsák','Prémium huzat'],[25,45]],
['bench','Pad','seat',40,3,3.2,1.3,'furniture','bench',['Fa','Párnázott','Támlás'],[30,50]],
['stool','Gurulós tréneri szék','seat',30,2,1.4,1.4,'furniture','stool',['Gurulós','Párnázott','Ergonomikus'],[25,45]],
['table','Kerek asztal','surface',30,4,3.2,3.2,'furniture','roundtable',['Klasszikus','Fa asztallap','Prémium felület'],[30,50]],
['modular','Összetolható asztal','surface',40,6,3.5,2,'furniture','table',['Alap','Mobil','Prémium'],[30,55]],
['standing','Állóasztal','surface',45,3,2.6,1.6,'furniture','standing',['Magas asztal','Állítható','Prémium'],[35,60]],
['side','Lerakóasztal','surface',20,4,1.8,1.8,'furniture','side',['Kis asztal','Tárolóval','Prémium'],[20,35]],
['flipchart','Flipchart','tools',25,3,2,1.7,'furniture','flipchart',['Állványos','Gurulós','Kétoldalas mágneses'],[25,45]],
['whiteboard','Mobil írótábla','tools',45,3,3,1.4,'furniture','whiteboard',['Írható','Mágneses','Kétoldalas'],[30,55]],
['pinboard','Parafatábla','tools',35,2,3.4,1,'wall','pinboard',['Parafa','Kártyakészlettel','Teljes ötletfal'],[30,50]],
['cart','Eszközöskocsi','tools',35,2,2,1.6,'furniture','cart',['Kis kocsi','Kétpolcos','Felszerelt'],[25,45]],
['timer','Időmérő','tools',15,2,1,0.8,'tabletop','timer',['Analóg','Színes időjelző','Digitális'],[15,30]],
['markers','Filckészlet','tools',10,3,1,0.7,'tabletop','markers',['Alapkészlet','Színes készlet','Teljes trénerkészlet'],[15,25]],
['coffee','Kávésarok','comfort',70,1,3,2,'furniture','coffee',['Termosz és tálca','Kávépult','Kávéállomás'],[60,110]],
['water','Vízadagoló','comfort',35,1,1.5,1.7,'furniture','water',['Víztartály','Hűtött víz','Prémium adagoló'],[30,50]],
['ac','Klíma','comfort',40,1,3,0.9,'wall','ac',['Alap','Csendes','Prémium'],[40,70]],
['coat','Kabátállvány','comfort',25,2,1.5,1.5,'furniture','coat',['Fa','Állítható','Öltözősarok'],[20,40]],
['acoustic','Akusztikai panel','comfort',40,3,2.8,1,'wall','acoustic',['Filc','Mintázott','Fa lamellás'],[35,60]],
['plant','Zöld sarok','mood',15,6,1.5,1.5,'furniture','plant',['Kis növény','Dús növény','Nagy dézsa'],[20,35]],
['rug','Puha szőnyeg','mood',35,2,5,3.5,'floor','rug',['Sima','Mintás','Szövött'],[30,50]],
['lamp','Állólámpa','mood',25,3,1.3,1.3,'furniture','lamp',['Olvasólámpa','Meleg fény','Hangulatfény'],[25,40]],
['curtain','Függöny','mood',30,2,3,1,'wall','curtain',['Könnyű','Sötétítő','Réteges'],[25,45]],
['picture','Falikép','mood',20,3,2.4,1,'wall','picture',['Nyomat','Keretezett','Galériakép'],[20,40]],
['bookshelf','Könyvespolc','mood',40,2,3,1.2,'furniture','bookshelf',['Kis polc','Könyvespolc','Szakmai könyvtár'],[40,70]],
['window','Panorámaablak','personal',40,2,4,1,'wall','window',['Ablak','Nagy ablak','Panoráma'],[60,100]],
['terrace','Teraszajtó','personal',180,1,4.5,1,'wall','terrace',['Kijárat','Franciaajtó','Panorámaterasz'],[90,160]],
['fireplace','Kandalló','personal',120,1,3,1.5,'furniture','fireplace',['Kandalló','Kőburkolat','Prémium kandalló'],[65,110]],
['sign','Saját trénertábla','personal',25,1,3,1,'wall','sign',['Felirat','Keretezett','Világító tábla'],[25,45]],
['mug','Saját bögre','personal',10,2,0.8,0.8,'tabletop','mug',['Kerámia','Saját jel','Kézműves'],[15,25]],
['ship','Jégtörő hajómodell','personal',30,1,1.5,0.8,'tabletop','ship',['Hajómodell','Részletes modell','Gyűjtői darab'],[30,50]],
['guitar','Hangszer','personal',35,1,1.3,2,'furniture','guitar',['Akusztikus','Díszes','Mesterdarab'],[30,50]],
['chess','Sakk-készlet','personal',25,1,1.4,1.4,'tabletop','chess',['Fa készlet','Faragott','Gyűjtői'],[25,40]],
['ball','Saját labda','personal',15,2,1.2,1.2,'furniture','ball',['Labda','Klubszínek','Dísztalppal'],[20,35]],
['plush-bear','Dobálható plüssmackó','play',15,0,1.1,1.1,'furniture','bear',['Puha mackó','Sálas mackó','Nagy ölelés'],[15,25]],
['plush-fox','Dobálható plüssróka','play',15,0,1.1,1.1,'furniture','fox',['Puha róka','Bolyhos róka','Nagy fülek'],[15,25]],
['plush-octopus','Dobálható plüsspolip','play',15,0,1.2,1.2,'furniture','octopus',['Kis polip','Színes polip','Óriás mosoly'],[15,25]],
['flowers-pot','Cserepes virág','mood',15,0,1.2,1.2,'furniture','flowers',['Kis virág','Virágzó csokor','Dús virágkompozíció'],[20,30]],
['flowers-vase','Virágváza az asztalra','mood',15,0,.8,.8,'tabletop','vase',['Egy szál virág','Csokor','Díszváza'],[15,25]],
['tree-ficus','Szobafa','mood',40,0,2.4,2.4,'furniture','tree',['Kis fikusz','Lombos fa','Nagy szobafa'],[35,55]],
['tree-palm','Pálma','mood',45,0,2.8,2.8,'furniture','palm',['Kis pálma','Dús pálma','Trópusi sarok'],[35,60]],
['hanging-plant','Fali futónövény','mood',25,0,1.6,1,'wall','hanging',['Fali kaspó','Futónövény','Zöld falrészlet'],[20,40]],
['wall-whiteboard','Falra szerelt whiteboard','tools',40,0,4,1,'wall','wallboard',['Írótábla','Mágneses tábla','Nagy ötletfal'],[35,60]],
['wall-clock','Falióra','mood',20,0,1.2,1,'wall','clock',['Klasszikus','Letisztult','Díszes'],[20,35]],
['rug-large','Nagy szőnyeg · 4 × 4 m','mood',90,0,8,8,'floor','rug',['Puha','Mintás','Prémium szövött'],[45,70]],
['decor-sculpture','Dekorszobor','personal',25,0,1.2,1.2,'furniture','sculpture',['Absztrakt forma','Kompozíció','Galériadarab'],[25,40]]
];
export const products=data.map(([id,name,category,price,max,w,h,layer,art,levels,upgrades])=>({id,name,category,price,max:null,w,h,layer,art,levels,upgrades,surface:['table','modular','standing','side','cart','coffee'].includes(id)}));
export const product=id=>products.find(p=>p.id===id);
export const defaultSettings=()=>({theme:'ice',wall:'ice',floor:'oak',view:'water',motto:'Itt lehet újrapróbálni.'});
