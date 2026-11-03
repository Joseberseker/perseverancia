// Fotos reales de Percy, elegidas a mano de la API de imágenes en bruto de la NASA:
// https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json
//
// Criterio: de los últimos días (sol 2014-2024 de una misión que va por el 2024),
// en color, que se sienta Marte. Fuera cielo vacío, el sol, blancos de calibración
// y miniaturas. Las miré una a una en hojas de contactos antes de escoger.
// Crédito de todas: NASA/JPL-Caltech (dominio público).

export const CREDITO = 'NASA/JPL-Caltech'

// Sol 0 = el amartizaje, 18 de febrero de 2021.
export const CAMARAS = [
  {
    pieza: "Mastcam_Z_cams",
    nombre: "Mastcam-Z",
    detalle: "El teleobjetivo en lo alto del mástil. Ve en color y hace zoom.",
    instrumento: "MCZ_LEFT",
    fotos: [
      {
        id: "ZL0_2024_0846622126_144EBY_N0930000ZCAM10058_1100LMJ",
        sol: 2024,
        utc: "2026-10-30T09:14:15.577",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02024/ids/edr/browse/zcam/ZL0_2024_0846622126_144EBY_N0930000ZCAM10058_1100LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/ZL0_2024_0846622126_144EBY_N0930000ZCAM10058_1100LMJ",
        pie: "Una roca clara con su sombra larga, a unos metros del rover.",
      },
      {
        id: "ZL0_2024_0846622049_145EBY_N0930000ZCAM10058_1100LMJ",
        sol: 2024,
        utc: "2026-10-30T09:13:06.580",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02024/ids/edr/browse/zcam/ZL0_2024_0846622049_145EBY_N0930000ZCAM10058_1100LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/ZL0_2024_0846622049_145EBY_N0930000ZCAM10058_1100LMJ",
        pie: "Un bloque grande partido, de los que Percy estudia antes de perforar.",
      },
      {
        id: "ZL0_2018_0846091074_665EBY_N0920000ZCAM05069_0340LMJ",
        sol: 2018,
        utc: "2026-10-24T05:43:15.348",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02018/ids/edr/browse/zcam/ZL0_2018_0846091074_665EBY_N0920000ZCAM05069_0340LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/ZL0_2018_0846091074_665EBY_N0920000ZCAM05069_0340LMJ",
        pie: "Las brocas del taladro en primer plano y, detrás, el horizonte de Jezero.",
      },
      {
        id: "ZL0_2019_0846179475_973EBY_N0920000ZCAM04495_1100LMJ",
        sol: 2019,
        utc: "2026-10-25T06:16:34.048",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02019/ids/edr/browse/zcam/ZL0_2019_0846179475_973EBY_N0920000ZCAM04495_1100LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/ZL0_2019_0846179475_973EBY_N0920000ZCAM04495_1100LMJ",
        pie: "Un campo de piedras sueltas sobre el regolito.",
      },
      {
        id: "ZL0_2020_0846263319_193EBY_N0920000ZCAM10053_0480LMJ",
        sol: 2020,
        utc: "2026-10-26T05:34:04.720",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02020/ids/edr/browse/zcam/ZL0_2020_0846263319_193EBY_N0920000ZCAM10053_0480LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/ZL0_2020_0846263319_193EBY_N0920000ZCAM10053_0480LMJ",
        pie: "Suelo marciano con guijarros, en color real.",
      },
    ],
  },
  {
    pieza: "NavCams",
    nombre: "Navcam",
    detalle: "Los ojos de navegación. Miran al horizonte para decidir por dónde ir.",
    instrumento: "NAVCAM_LEFT",
    fotos: [
      {
        id: "NLF_2022_0846455800_722ECM_N0930000NCAM13022_04_195J",
        sol: 2022,
        utc: "2026-10-28T11:01:56.490",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02022/ids/edr/browse/ncam/NLF_2022_0846455800_722ECM_N0930000NCAM13022_04_195J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_2022_0846455800_722ECM_N0930000NCAM13022_04_195J",
        pie: "Una meseta recortada contra el cielo: el borde del cráter Jezero.",
      },
      {
        id: "NLF_2022_0846456110_237ECM_N0930000NCAM02022_01_195J",
        sol: 2022,
        utc: "2026-10-28T11:07:05.389",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02022/ids/edr/browse/ncam/NLF_2022_0846456110_237ECM_N0930000NCAM02022_01_195J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_2022_0846456110_237ECM_N0930000NCAM02022_01_195J",
        pie: "La cubierta del rover en primer plano y una colina al fondo.",
      },
      {
        id: "NLF_2022_0846455800_722ECM_N0930000NCAM13022_01_195J",
        sol: 2022,
        utc: "2026-10-28T11:01:56.490",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02022/ids/edr/browse/ncam/NLF_2022_0846455800_722ECM_N0930000NCAM13022_01_195J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_2022_0846455800_722ECM_N0930000NCAM13022_01_195J",
        pie: "La llanura abierta hasta la cordillera del horizonte.",
      },
      {
        id: "NLF_2023_0846548592_316ECM_N0930000NCAM00347_04_195J",
        sol: 2023,
        utc: "2026-10-29T12:48:30.042",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02023/ids/edr/browse/ncam/NLF_2023_0846548592_316ECM_N0930000NCAM00347_04_195J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_2023_0846548592_316ECM_N0930000NCAM00347_04_195J",
        pie: "La sombra del propio Percy, con el mástil dibujado en la arena.",
      },
      {
        id: "NLF_2018_0846090470_395ECM_N0920000NCAM00709_03_095J",
        sol: 2018,
        utc: "2026-10-24T05:33:02.240",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02018/ids/edr/browse/ncam/NLF_2018_0846090470_395ECM_N0920000NCAM00709_03_095J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_2018_0846090470_395ECM_N0920000NCAM00709_03_095J",
        pie: "Rocas claras de cerca, iluminadas de lado.",
      },
    ],
  },
  {
    pieza: "hazcams_front",
    nombre: "Hazcam delantera",
    detalle: "Gran angular bajo el morro. Vigila las rocas justo delante de las ruedas.",
    instrumento: "FRONT_HAZCAM_LEFT_A",
    fotos: [
      {
        id: "FLF_2023_0846549745_302ECM_N0930000FHAZ00206_01_295J",
        sol: 2023,
        utc: "2026-10-29T13:07:42.945",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02023/ids/edr/browse/fcam/FLF_2023_0846549745_302ECM_N0930000FHAZ00206_01_295J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_2023_0846549745_302ECM_N0930000FHAZ00206_01_295J",
        pie: "Gran angular desde el morro: rocas, rueda y el horizonte curvado.",
      },
      {
        id: "FLF_2019_0846185639_601ECM_N0920000FHAZ00206_01_295J",
        sol: 2019,
        utc: "2026-10-25T07:59:12.971",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02019/ids/edr/browse/fcam/FLF_2019_0846185639_601ECM_N0920000FHAZ00206_01_295J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_2019_0846185639_601ECM_N0920000FHAZ00206_01_295J",
        pie: "El brazo robótico apoyado en el suelo, con la rueda a la izquierda.",
      },
      {
        id: "FLF_2017_0846007969_307ECM_N0920000FHAZ00203_19_295J",
        sol: 2017,
        utc: "2026-10-23T06:38:01.131",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02017/ids/edr/browse/fcam/FLF_2017_0846007969_307ECM_N0920000FHAZ00203_19_295J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_2017_0846007969_307ECM_N0920000FHAZ00203_19_295J",
        pie: "La torreta del brazo iluminada sobre la arena.",
      },
      {
        id: "FLF_2017_0846002466_012ECM_N0920000FHAZ00206_01_295J",
        sol: 2017,
        utc: "2026-10-23T05:06:18.065",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02017/ids/edr/browse/fcam/FLF_2017_0846002466_012ECM_N0920000FHAZ00206_01_295J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_2017_0846002466_012ECM_N0920000FHAZ00206_01_295J",
        pie: "El brazo trabajando, con la cresta del cráter al fondo.",
      },
      {
        id: "FLF_2018_0846088669_950ECM_N0920000FHAZ00203_19_295J",
        sol: 2018,
        utc: "2026-10-24T05:03:02.477",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02018/ids/edr/browse/fcam/FLF_2018_0846088669_950ECM_N0920000FHAZ00203_19_295J01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/FLF_2018_0846088669_950ECM_N0920000FHAZ00203_19_295J",
        pie: "Lo que ve Percy justo delante de las ruedas antes de avanzar.",
      },
    ],
  },
  {
    pieza: "WATSON",
    nombre: "WATSON",
    detalle: "La lupa del brazo robótico. Fotografía la roca a unos centímetros.",
    instrumento: "SHERLOC_WATSON",
    fotos: [
      {
        id: "SIF_2019_0846185764_324EBY_N0920000SRLC00878_0000LMJ",
        sol: 2019,
        utc: "2026-10-25T08:01:48.109",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02019/ids/edr/browse/shrlc/SIF_2019_0846185764_324EBY_N0920000SRLC00878_0000LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/SIF_2019_0846185764_324EBY_N0920000SRLC00878_0000LMJ",
        pie: "El agujero que deja el taladro al sacar una muestra de roca.",
      },
      {
        id: "SIF_2023_0846550026_515EBY_N0930000SRLC00630_0000LMJ",
        sol: 2023,
        utc: "2026-10-29T13:12:46.007",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02023/ids/edr/browse/shrlc/SIF_2023_0846550026_515EBY_N0930000SRLC00630_0000LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/SIF_2023_0846550026_515EBY_N0930000SRLC00630_0000LMJ",
        pie: "Una roca porosa a unos centímetros: la lupa del brazo.",
      },
      {
        id: "SIF_2019_0846185766_167EBY_N0920000SRLC00878_0000LMJ",
        sol: 2019,
        utc: "2026-10-25T08:01:52.101",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02019/ids/edr/browse/shrlc/SIF_2019_0846185766_167EBY_N0920000SRLC00878_0000LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/SIF_2019_0846185766_167EBY_N0920000SRLC00878_0000LMJ",
        pie: "El mismo sondeo visto de más cerca, con el polvo alrededor.",
      },
      {
        id: "SIF_2023_0846550025_000EBY_N0930000SRLC00630_0000LMJ",
        sol: 2023,
        utc: "2026-10-29T13:12:43.007",
        url: "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/02023/ids/edr/browse/shrlc/SIF_2023_0846550025_000EBY_N0930000SRLC00630_0000LMJ01_1200.jpg",
        enlace: "https://mars.nasa.gov/mars2020/multimedia/raw-images/SIF_2023_0846550025_000EBY_N0930000SRLC00630_0000LMJ",
        pie: "Textura de la roca, grano a grano.",
      },
    ],
  },
]

export const POR_PIEZA = Object.fromEntries(CAMARAS.map((c) => [c.pieza, c]))
