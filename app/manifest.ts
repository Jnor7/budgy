import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{return {name:"Budgy",short_name:"Budgy",description:"Votre quotidien financier et vos projets.",start_url:"/",display:"standalone",background_color:"#f4f5f8",theme_color:"#8050f2",orientation:"portrait-primary",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"maskable"}]};}
