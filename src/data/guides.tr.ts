/**
 * Turkish translation of the coaching content in guides.ts.
 * Keys, array lengths and item order mirror GUIDES exactly; other code
 * refers to `cues` and `mistakes` by index.
 */

import type { Guide } from './guides';

export const GUIDES_TR: Record<string, Guide> = {
  squat: {
    why: 'Tüm alt vücut hareketlerinin temeli; bacakları ve kalçayı güçlendirir, gündelik hayatta oturup kalkmayı kolaylaştırır.',
    setup: [
      'Ayaklar omuz genişliğinden biraz açık, ayak uçları 15-30 derece dışa dönük.',
      'Ağırlığı ayak tabanının üç noktasına yay: topuk, başparmağın altı ve serçe parmağın altı.',
      'Denge için ellerini göğsünün önünde birleştir ya da öne doğru uzat.',
    ],
    steps: [
      'Arkandaki bir sandalyeye oturur gibi, aynı anda kalçanı geriye, dizlerini öne ve hafifçe dışa gönder.',
      'Uylukların yere paralel olana kadar ya da belin düz kalabildiği yere kadar in.',
      'Ayak tabanının tamamıyla yeri iterek kalk; kalça ve omuzlar aynı anda yükselsin.',
      'Yukarıda kalçanı sık, ama dizlerini kilitleme.',
    ],
    cues: [
      'Dizler ayak uçlarıyla aynı yönde, ikinci ve üçüncü parmağın hizasında hareket etsin.',
      'Topuklar hareket boyunca yerden kalkmasın.',
      'Bel nötr kalsın: ne yuvarlansın ne de fazla çukurlaşsın.',
      'Göğüs açık, bakışlar yaklaşık iki metre ileride, yerde.',
      'İniş 2-3 saniye, kalkış yaklaşık 1 saniye.',
    ],
    breath: 'İnmeden önce nefes al ve karnını sıkı tut; kalkışın yarısında nefesini ver.',
    feel: 'Ön bacak ve kalça. Dizinin önünde ya da belinde ağrı olursa derinliği azalt.',
    mistakes: [
      { m: 'Dizler içe çöküyor.', fix: 'Ayaklarınla yeri ikiye ayırmak istediğini düşün; dizlerini ayak uçlarınla aynı hizada tut.' },
      { m: 'Topuk yerden kalkıyor.', fix: 'Ağırlığı ayağının ortasına ve topuğuna al. Ayak bileğin sertse ayaklarını biraz daha aç.' },
      { m: 'Hareketin dibinde bel yuvarlanıyor.', fix: 'Sadece belinin düz kaldığı derinliğe kadar in; derinlik antrenmanla artar.' },
      { m: 'Kalça göğüsten önce kalkıyor.', fix: 'Sadece kalçanı itmeyi değil, göğsünü ve kalçanı birlikte yukarı taşımayı düşün.' },
    ],
  },

  goblet: {
    why: 'Ağırlığı vücudun önünde tutarak yapılan squat; gövdeyi dik tutmayı ve doğru derinliği öğrenmeyi kolaylaştırır.',
    setup: [
      'Dambılı dikey tut; iki elin üst başlığın altında, dambıl göğüs kemiğine yaslı.',
      'Dirsekler aşağıya dönük ve vücuda yakın.',
      'Ayaklar omuz genişliğinden biraz açık, ayak uçları hafifçe dışa dönük.',
    ],
    steps: [
      'Kalçanı geriye, dizlerini öne gönder ve dik bir şekilde in.',
      'Aşağıda dirseklerin iki dizinin arasına gelsin.',
      'Ayak tabanınla yeri iterek kalk, dambılı göğsüne yaslı tutmaya devam et.',
    ],
    cues: [
      'Dambıl hareket boyunca göğsüne yaslı kalsın.',
      'Gövde normal squata göre daha dik kalsın.',
      'Aşağıda dirseklerin dizlerini dışarı itsin.',
      'Topuklar yerde.',
    ],
    breath: 'Yukarıda nefes al, inerken tut, kalkarken ver.',
    feel: 'Bacaklar, kalça ve karın. Daha çok belin yoruluyorsa daha hafif bir dambıl al.',
    mistakes: [
      { m: 'Dambıl göğüsten uzaklaşıyor.', fix: 'Kollarını kaburgalarına yapıştır; dambılı vücuduna doğru bastır.' },
      { m: 'Gövde fazla öne eğiliyor.', fix: 'Daha hafif bir dambıl al ve göğsünü yukarıda tut.' },
      { m: 'Sırtın üst kısmı yuvarlanıyor.', fix: 'Kürek kemiklerini hafifçe geriye ve aşağıya çek, karşıya bak.' },
    ],
  },

  backsquat: {
    why: 'Halterle yapılan en güçlü alt vücut hareketi; bacak ve kalçada kuvvet ve hacim için.',
    setup: [
      'Halteri boyun kemiğine değil, trapez kasının (omuzların arkası) üzerine yerleştir.',
      'Eller omuz genişliğinden biraz açık, dirsekler aşağıya dönük.',
      'Halteri sehpadan al, geriye iki kısa adım at ve ayaklarını omuz genişliğinden biraz açık yerleştir.',
    ],
    steps: [
      'Derin bir nefes al ve karnını bir kemer gibi çepeçevre sık.',
      'Kalça geriye, dizler öne; kontrollü şekilde paralele ya da biraz altına in.',
      'Ayaklarınla yeri it ve halteri dikey bir çizgide yukarı çıkar.',
      'Yukarıda nefesini ver ve sonraki tekrar için yeniden nefes al.',
    ],
    cues: [
      'Halter hareket boyunca ayak ortasının üzerinde kalsın.',
      'Kalça ve omuzlar birlikte yükselsin.',
      'Dizler ayak uçlarıyla aynı yönde.',
      'Boyun omurganın devamında; tavana bakma.',
    ],
    breath: 'Her tekrarda: yukarıda derin nefes, hareket boyunca nefesi tut, yukarıda ver.',
    feel: 'Bacaklar, kalça ve ağırlığı taşımak için tüm kor bölgesi.',
    mistakes: [
      { m: 'Kalça omuzlardan önce kalkıyor ve hareket öne eğilmeye benziyor.', fix: 'Ağırlığı azalt ve sırtınla haltere doğru itmeyi düşün.' },
      { m: 'Kalkarken dizler içe çöküyor.', fix: 'Dizlerini bilinçli olarak dışarı it; olmuyorsa ağırlık fazla.' },
      { m: 'Aşağıda bel yuvarlanıyor.', fix: 'Derinliği azalt, nefes almayı ve karnını sıkmayı çalış.' },
    ],
    safety: 'Her zaman sehpanın emniyet barlarıyla ya da bir yardımcıyla çalış. Formu önce hafif ağırlıkla öğren.',
  },

  lunge: {
    why: 'Denge, kalça ve bacaklar için tek bacak çalışması; geriye lunge öndeki dize daha az yük bindirir.',
    setup: [
      'Dik dur, ayaklar kalça genişliğinde.',
      'Eller belde ya da vücudun yanında serbest.',
    ],
    steps: [
      'Geriye doğru uzun bir adım at ve arka ayağının ucuna bas.',
      'Arka dizin yere birkaç santim kalana kadar iki dizini de bük.',
      'Ön ayağının topuğuyla yeri iterek başlangıç pozisyonuna dön.',
      'Bacak değiştir ya da bir bacağın tüm tekrarlarını arka arkaya yap.',
    ],
    cues: [
      'Ağırlığın çoğu ön bacakta olsun.',
      'Ön diz ayak bileğinin üzerinde kalsın, içe düşmesin.',
      'Ayakların arasında kalça genişliği kadar mesafe olsun; tek çizgi üzerinde değil, iki tren rayı gibi.',
      'Kalça karşıya baksın, dönmesin.',
      'Gövde dik ya da hafifçe öne eğik.',
    ],
    breath: 'İnerken nefes al, kalkarken ver.',
    feel: 'Ön bacağın kalçası ve ön tarafı.',
    mistakes: [
      { m: 'Denge bozuluyor.', fix: 'Ayaklarını arka arkaya değil, iki ayrı çizgiye koy; önce duvarın yanında çalış.' },
      { m: 'Ön diz içe çöküyor.', fix: 'Dizini ikinci ayak parmağının hizasında tut; daha yavaş in.' },
      { m: 'Arka diz yere çarpıyor.', fix: 'Kontrollü in ve yerin birkaç santim üzerinde dur.' },
      { m: 'Arka bacağınla itiyorsun.', fix: 'Arka bacak sadece denge içindir; ön ayağının topuğuyla kalk.' },
    ],
  },

  bridge: {
    why: 'Dize ve bele yük bindirmeden kalçayı çalıştırır; yeni başlayanlar ve diz ağrısı olanlar için harikadır.',
    setup: [
      'Sırtüstü uzan; dizler bükülü, ayak tabanları kalça genişliğinde yerde.',
      'Topuklar kalçadan yaklaşık bir karış uzakta olsun.',
      'Eller vücudun yanında, avuç içleri yere dönük.',
    ],
    steps: [
      'Karnını sık ve belin yere yaklaşsın diye leğen kemiğini hafifçe geriye yatır.',
      'Topuklarınla yeri iterek kalçanı kaldır; omuz, kalça ve diz tek çizgide olsun.',
      'Yukarıda bir iki saniye bekle ve kalçanı iyice sık.',
      'Yavaşça, omur omur aşağı in.',
    ],
    cues: [
      'Baskı ayak ucunda değil, topuklarda olsun.',
      'Dizler kalça genişliğinde kalsın; ne açılsın ne kapansın.',
      'Belini çukurlaştırarak değil, kalçanla yüksel.',
      'Ağırlık boyunda değil, kürek kemiklerinde olsun; başını oynatma.',
    ],
    breath: 'Yükselirken nefes ver, inerken nefes al.',
    feel: 'Kalça ve biraz arka bacak. Sadece arka bacağında hissediyorsan ayaklarını kalçana biraz yaklaştır.',
    mistakes: [
      { m: 'Bel çukurlaşıyor ve kalça çalışmıyor.', fix: 'Yükselmeden önce leğen kemiğini geriye yatır ve kaburgalarını aşağıda tut.' },
      { m: 'Dizler dışa açılıyor.', fix: 'Dizlerini paralel tut; dizlerinin arasında bir yastık sıkıştırabilirsin.' },
      { m: 'Arka bacağa kramp giriyor.', fix: 'Ayaklarını daha yakına koy ve ayak ucunla değil, topuğunla it.' },
    ],
  },

  rdl: {
    why: 'Arka bacak ve kalça için en iyi hareket; kalçadan "menteşe" gibi katlanmayı öğretir, bu da yerden bir şey kaldırırken belini korur.',
    setup: [
      'Ayakta dur; ayaklar kalça genişliğinde, dambıllar uylukların önünde, avuç içleri vücuda dönük.',
      'Dizler hafif bükülü ve yumuşak, kilitli değil.',
      'Omuzlar geride, bel düz.',
    ],
    steps: [
      'Kalçanla arkandaki bir kapıyı kapatıyormuş gibi, kalçanı dümdüz geriye it.',
      'Dambılları uyluklarına ve kaval kemiklerine yakın indir; arka bacağında belirgin bir gerilme hissedene kadar, genellikle dizin biraz altına.',
      'Kalçanı öne getirip sıkarak ayakta duruşa dön.',
    ],
    cues: [
      'Bel baştan sona düz kalsın.',
      'Diz açısı hareket boyunca neredeyse sabit kalsın.',
      'Dambıllar bacaklara yakın hareket etsin, vücuttan uzaklaşmasın.',
      'Boyun omurganın devamında; ayaklarının önündeki zemine bak.',
    ],
    breath: 'Yukarıda nefes al ve karnını sık, in, kalkarken nefesini ver.',
    feel: 'Arka bacak ve kalça. Daha çok belinde hissediyorsan derinliği azalt.',
    mistakes: [
      { m: 'Bel yuvarlanıyor.', fix: 'Sadece belinin düz kaldığı yere kadar in; göğsünü açık tut.' },
      { m: 'Dizler fazla bükülüyor ve hareket squata benziyor.', fix: 'Kalçanı aşağı indirmeyi değil, geriye götürmeyi düşün.' },
      { m: 'Dambıllar vücuttan uzaklaşıyor.', fix: 'Dambılları neredeyse uyluklarına ve kaval kemiklerine sürterek indir.' },
      { m: 'Yukarıda geriye doğru yaylanıyorsun.', fix: 'Dik duruşa geldiğinde dur; sadece kalçanı sık.' },
    ],
    safety: 'Bel ağrın varsa bu hareketi hafif ağırlıkla ve bir antrenöre danışarak yap.',
  },

  deadlift: {
    why: 'Tüm vücut için temel kuvvet hareketi; arka bacağı, kalçayı, sırtı ve kor bölgesini aynı anda çalıştırır.',
    setup: [
      'Halter ayak ortasının üzerinde, kaval kemiğinden yaklaşık 3 cm uzakta. Ayaklar kalça genişliğinde.',
      'Eğil ve halteri bacaklarının hemen dışından tut.',
      'Kaval kemiklerini haltere değene kadar öne getir. Göğüs yukarıda, bel düz.',
      'Kollar düz; halter "boşta" kalmasın diye kollarında ve sırtında gerginliği hisset.',
    ],
    steps: [
      'Derin bir nefes al ve karnını sık.',
      'Ayaklarınla yeri it; halter kaval kemiğine yakın yükselsin.',
      'Halter dizleri geçince kalçanı öne getir ve tamamen dikleş.',
      'Aynı yoldan geri dön: önce kalça geriye, halter dizleri geçince dizler bükülsün.',
    ],
    cues: [
      'Halter bacaklara yapışık şekilde, dikey bir çizgide hareket etsin.',
      'Kalça ve omuzlar birlikte yükselsin.',
      'Dirsekler düz; eller sadece birer kanca.',
      'Yukarıda dik dur; geriye yaylanma.',
    ],
    breath: 'Her tekrarda: derin nefes, hareket boyunca nefesi tut, dikleşince ver.',
    feel: 'Arka bacak, kalça, sırt ve ön kol.',
    mistakes: [
      { m: 'Bel yuvarlanıyor.', fix: 'Ağırlığı azalt; çekmeden önce belini düzelt ve karnını sık.' },
      { m: 'Halter vücuttan uzaklaşıyor.', fix: 'Kanat kaslarını devreye sok; koltuk altında bir portakal tutmak istiyormuş gibi.' },
      { m: 'Kalça erken kalkıyor ve sadece bel çekiyor.', fix: 'Halteri çekmeyi değil, ayaklarınla yeri itmeyi düşün.' },
      { m: 'Halter yerden silkelenerek kaldırılıyor.', fix: 'Önce gerginliği oluştur, sonra yavaş ve kesintisiz çek.' },
    ],
    safety: 'Teknik bir harekettir; çok hafif ağırlıkla başla ve mümkünse bir antrenör eşliğinde öğren.',
  },

  pushup: {
    why: 'Göğüs, arka kol ve omuzlar için temel itiş hareketi; kor bölgesi de vücudu düz tutmak için çalışır.',
    setup: [
      'Eller omuz genişliğinden biraz açık, bilekler omuzların altında, parmaklar ileriye dönük.',
      'Ayaklar bitişik ya da hafif açık, parmak uçlarında.',
      'Vücut baştan topuğa tek bir düz çizgi; karın ve kalça sıkı.',
    ],
    steps: [
      'Dirseklerini vücuduna yaklaşık 45 derecelik açıyla bük.',
      'Göğsünü yere birkaç santim kalana kadar indir.',
      'Avuçlarınla yeri kendinden uzaklaştır ve yukarı dön.',
    ],
    cues: [
      'Vücut düz bir tahta gibi kalsın; kalça ne düşsün ne de havaya kalksın.',
      'Dirsekler vücuda 45 derece; yanlara tamamen açık değil.',
      'Yere yüzünden önce göğsün yaklaşsın.',
      'Yukarıda, yeri itiyormuş gibi kürek kemiklerini hafifçe birbirinden uzaklaştır.',
      'Baş vücudun devamında; bakışlar ellerin biraz ilerisinde.',
    ],
    breath: 'İnerken nefes al, kalkarken ver.',
    feel: 'Göğüs, arka kol ve ön omuz; vücudu tutmak için karın.',
    mistakes: [
      { m: 'Kalça düşüyor ve bel çukurlaşıyor.', fix: 'Kalçanı ve karnını sık; yapamıyorsan dizlerinin üzerinde ya da ellerini bir masaya koyarak yap.' },
      { m: 'Dirsekler 90 derece yanlara açılıyor.', fix: 'Dirseklerini biraz kaburgalarına doğru getir; bu omuzlarındaki yükü azaltır.' },
      { m: 'Hareket yarım yapılıyor.', fix: 'Az ama tam tekrar; göğsün yere birkaç santim kalana kadar inmeli.' },
      { m: 'Baş vücuttan önce iniyor.', fix: 'Çeneni hafifçe geriye çek ve göğsünle in.' },
    ],
  },

  kneepush: {
    why: 'Şınavın aynı formla yapılan daha kolay hali; tam şınava giden ilk adım.',
    setup: [
      'Dizler yerde (altlarına bir havlu ya da mat koy), eller omuz genişliğinden biraz açık.',
      'Vücut baştan dize tek bir düz çizgi; kalça ne yukarıda ne aşağıda.',
      'Ayaklarını yerden kaldırıp çapraz yapabilirsin.',
    ],
    steps: [
      'Dirseklerini vücuduna 45 derece açıyla bük ve göğsünü yere yaklaştır.',
      'Yeri it ve yukarı dön.',
    ],
    cues: [
      'Baştan dize düz bir çizgi; kalçanı sıkı tut.',
      'Eller omuzların altında, daha ileride değil.',
      'Tam hareket: göğüs yere yakın.',
      '12 tekrarlık 3 seti rahatça yapınca tam şınava geç.',
    ],
    breath: 'İnerken nefes al, kalkarken ver.',
    feel: 'Göğüs, arka kol ve omuz.',
    mistakes: [
      { m: 'Kalça yukarıda kalıyor ve vücut kırık duruyor.', fix: 'Kalçanı öne getir; uylukların ve gövden tek çizgide olsun.' },
      { m: 'Eller omuzların çok ilerisinde.', fix: 'Ellerini geriye al; bileklerin omuzlarının altında olsun.' },
    ],
  },

  floorpress: {
    why: 'Sehpa olmadan dambılla göğüs presi; zemin hareket açıklığını sınırlar, omuzlar daha güvende kalır.',
    setup: [
      'Sırtüstü uzan; dizler bükülü, ayak tabanları yerde.',
      'Dambıllar elinde; üst kollar vücuda yaklaşık 45 derece açıyla yerde, ön kollar dik.',
      'Kürek kemiklerini hafifçe birbirine yaklaştır ve yere bastır.',
    ],
    steps: [
      'Dambılları göğsünün tam üzerine doğru it.',
      'Yukarıda dambıllar birbirine yaklaşsın ama çarpmasın.',
      'Arka kolların yere yumuşakça değene kadar yavaşça indir; bir an bekle.',
    ],
    cues: [
      'Bilek düz ve dirseğin üzerinde; geriye kırılmasın.',
      'Dirsekler vücuda 45 derece.',
      'Kürek kemikleri hareket boyunca yere bastırılmış.',
      'İniş kontrollü; dirseğini yere vurma.',
    ],
    breath: 'İterken nefes ver, indirirken nefes al.',
    feel: 'Göğüs ve arka kol.',
    mistakes: [
      { m: 'Dirsek yere çarpıyor.', fix: 'İndirmek için iki saniye harca.' },
      { m: 'Bilek geriye kırılıyor.', fix: 'Dambılı avucunun topuğunda tut, yumruğun düz olsun.' },
      { m: 'Dirsekler tamamen yanlara açılıyor.', fix: 'Dirseklerini biraz vücuduna doğru getir.' },
    ],
  },

  row: {
    why: 'Sırt kasları için çekiş hareketi; itiş hareketlerini dengeler ve omuzların dik durmasına yardımcı olur.',
    setup: [
      'Dambıllar elinde, dizler hafif bükülü.',
      'Kalçadan öne eğil; gövde yaklaşık 45 derece ya da daha fazla öne eğik, bel düz.',
      'Kollar omuzların altında aşağı sarkık.',
    ],
    steps: [
      'Önce kürek kemiklerini hafifçe geriye ve aşağıya çek.',
      'Dirseklerini dümdüz yukarı değil, kalçana doğru çek; dambıllar karnının yanına gelsin.',
      'Bir saniye bekle ve kürek kemiklerini birbirine sıkıştır.',
      'Kolların tamamen uzayana kadar yavaşça indir.',
    ],
    cues: [
      'Gövde hareket boyunca sabit kalsın.',
      'Dirsekler vücuda yakın.',
      'Omuzlar kulaklardan uzak dursun.',
      'Eller sadece birer kanca; sırtınla çek.',
    ],
    breath: 'Çekerken nefes ver, indirirken nefes al.',
    feel: 'Sırtın ortası ve üstü (kürek kemiklerinin arası ve altı), biraz da arka kol.',
    mistakes: [
      { m: 'Gövde sallanıyor ve ağırlık savruluyor.', fix: 'Ağırlığı azalt ve yukarıda bekle.' },
      { m: 'Bel yuvarlanıyor.', fix: 'Dizlerini biraz daha bük ve göğsünü açık tut.' },
      { m: 'Omuzlar kulaklara doğru kalkıyor.', fix: 'Her tekrardan önce kürek kemiklerini aşağı çek.' },
    ],
    safety: 'Bel ağrın varsa tek kolla yap; diğer elini ve bir dizini bir sehpaya ya da sandalyeye daya.',
  },

  superman: {
    why: 'Ağırlık kullanmadan bel boyunca uzanan kasları ve kalçayı güçlendirir; duruş için ve bel ağrısını önlemek için.',
    setup: [
      'Yere yüzüstü uzan; kollar başının ilerisine uzanmış, bacaklar düz.',
      'Alın yere yakın, boyun vücudun devamında.',
    ],
    steps: [
      'Kalçanı sık.',
      'Kollarını, göğsünü ve bacaklarını aynı anda yerden birkaç santim kaldır.',
      'İki üç saniye tut.',
      'Yavaşça in ve bir an dinlen.',
    ],
    cues: [
      'Az yükseklik yeter; fazla kalkmak yükü bele bindirir.',
      'Yere bak; başını kaldırma.',
      'Hareket yavaş ve kontrollü, silkelenmeden.',
      'Bacaklarını dizini bükerek değil, kalçanla kaldır.',
    ],
    breath: 'Kalkarken nefes ver, tutarken sakin nefes almaya devam et.',
    feel: 'Omurganın iki yanındaki kaslar, kalça ve omuzların arkası.',
    mistakes: [
      { m: 'Baş geriye bükülüyor.', fix: 'Bakışlarını yerde tut.' },
      { m: 'Hareket silkelenerek yapılıyor.', fix: 'İki saniye kalkış, iki saniye bekleme, iki saniye iniş.' },
    ],
    safety: 'Belinde keskin bir ağrı hissedersen sadece kollarını ya da sadece bacaklarını kaldır.',
  },

  press: {
    why: 'Baş üstü itişler için omuz ve arka kol kuvveti; kor bölgesi de vücudu sabit tutmak için çalışır.',
    setup: [
      'Ayakta dur, ayaklar kalça genişliğinde.',
      'Dambıllar omuz hizasında, avuç içleri karşıya ya da birbirine dönük, dirsekler vücudun biraz önünde.',
      'Karnını ve kalçanı sık.',
    ],
    steps: [
      'Dambılları dümdüz başının üzerine it.',
      'Yukarıda kolların kulaklarının yanında, dambıllar başının üzerinde olsun.',
      'Kontrollü şekilde omuz hizasına indir.',
    ],
    cues: [
      'Kaburgalar aşağıda kalsın; bel çukurlaşmasın.',
      'Bilek düz ve dirseğin üzerinde.',
      'Dambıllar öne değil, yukarı doğru hareket etsin.',
      'Dizler düz ama kilitli değil; bacaklarınla itme.',
    ],
    breath: 'İterken nefes ver, indirirken nefes al.',
    feel: 'Omuz ve arka kol.',
    mistakes: [
      { m: 'Bel çukurlaşıyor.', fix: 'Kalçanı ve karnını sık; olmuyorsa daha hafif ağırlık al ya da oturarak yap.' },
      { m: 'Dambıllar öne doğru itiliyor.', fix: 'Dambılları omuzlarının üzerinde, dikey bir çizgide tut.' },
      { m: 'Omuzlar kulaklara doğru toplanıyor.', fix: 'Hareketin alt noktasında omuzlarını aşağı indir.' },
    ],
    safety: 'Kolunu başının üzerine kaldırmak ağrı yapıyorsa hareket açıklığını azalt ya da bu hareketi bırak.',
  },

  plank: {
    why: 'Derin karın kaslarını güçlendirir; vücudunu düz ve sıkı tutmayı öğrenirsin, bu da her harekette gereklidir.',
    setup: [
      'Ön kollarının ve ayak uçlarının üzerine yerleş.',
      'Dirsekler tam omuzların altında, ön kollar paralel.',
      'Ayaklar kalça genişliğinde.',
    ],
    steps: [
      'Vücudunu düz bir şekilde yerden kaldır.',
      'Biri karnına yumruk atacakmış gibi karnını sık.',
      'Kalçanı sık ve sakin nefes alarak süreyi tamamla.',
    ],
    cues: [
      'Baştan topuğa tek bir düz çizgi.',
      'Omuzların çökmesin diye ön kollarınla yeri it.',
      'Yere bak, ellerinin biraz ilerisine.',
      'Kalite süreden önemli; form bozulduğunda set biter.',
    ],
    breath: 'Sakin ve düzenli nefes al; nefesini tutma.',
    feel: 'Karın, biraz omuz ve kalça. Belin ağrırsa bırak.',
    mistakes: [
      { m: 'Bel çöküyor.', fix: 'Kalçanı sık ve leğen kemiğini hafifçe geriye yatır; ya da dizlerinin üzerinde yap.' },
      { m: 'Kalça fazla yükseliyor.', fix: 'Kalçanı omuzlarınla aynı hizaya gelene kadar indir.' },
      { m: 'Nefes tutuluyor.', fix: 'Sesli say; sayabiliyorsan nefes alıyorsun demektir.' },
    ],
  },

  birddog: {
    why: 'Bel ve kalça stabilitesi; bel ağrısında da önerilen güvenli bir hareket.',
    setup: [
      'Dört ayak pozisyonu: eller omuzların altında, dizler kalçanın altında.',
      'Sırt masa gibi düz; boyun sırtın devamında.',
    ],
    steps: [
      'Karnını sık.',
      'Aynı anda sağ kolunu öne, sol bacağını geriye uzat; ikisi de gövdenle aynı hizaya gelsin.',
      'İki saniye tut.',
      'Geri dön ve sol kol ile sağ bacakla tekrarla.',
    ],
    cues: [
      'Kalça düz kalsın; belinin üzerinde bir bardak su varmış gibi.',
      'Kolunu ve bacağını yukarı değil, uzağa uzat.',
      'Yavaş; her tarafta iki saniye bekle.',
      'Yerdeki elin yeri itsin.',
    ],
    breath: 'Kolunu ve bacağını uzatırken nefes ver, dönerken nefes al.',
    feel: 'Karın, bel kasları ve kalça; ağrı olmadan.',
    mistakes: [
      { m: 'Kalça bir yana dönüyor.', fix: 'Bacağını daha az kaldır ve karnını daha çok sık.' },
      { m: 'Bel çukurlaşıyor.', fix: 'Bacağını sadece gövde hizasına kadar kaldır, daha fazla değil.' },
      { m: 'Hareket aceleyle yapılıyor.', fix: 'Her tarafta ikiye kadar say.' },
    ],
  },

  crunch: {
    why: 'Kısa ve kontrollü bir hareket açıklığıyla doğrudan düz karın kasını çalıştırır.',
    setup: [
      'Sırtüstü uzan; dizler bükülü, ayak tabanları yerde.',
      'Parmak uçları kulakların arkasında ya da eller göğüste çapraz.',
    ],
    steps: [
      'Karnını sık.',
      'Başını, omuzlarını ve sırtının üst kısmını karnınla birkaç santim kaldır.',
      'Yukarıda bir saniye bekle.',
      'Yavaşça in.',
    ],
    cues: [
      'Çenenle göğsün arasında bir yumruk kadar boşluk olsun.',
      'Belin yerde kalsın.',
      'Kısa hareket yeter; tamamen oturmana gerek yok.',
      'Başını iterek değil, karnınla kalk.',
    ],
    breath: 'Kalkarken nefes ver, inerken nefes al.',
    feel: 'Karın. Boynun yorulursa ellerini göğsüne koy.',
    mistakes: [
      { m: 'Baş ellerle çekiliyor.', fix: 'Eller sadece başı desteklesin; dirsekler açık kalsın.' },
      { m: 'Oturur pozisyona kadar kalkıyorsun.', fix: 'Kürek kemiklerin yerden ayrıldığında yeter.' },
      { m: 'Hareket hızlı ve savrularak yapılıyor.', fix: 'Bir saniye kalkış, bir saniye bekleme, iki saniye iniş.' },
    ],
  },

  jacks: {
    why: 'Kol ve bacak koordinasyonuyla ısınma ve nabzı yükseltme.',
    setup: [
      'Dik dur; ayaklar bitişik, kollar vücudun yanında.',
      'Dizler hafif bükülü ve yumuşak.',
    ],
    steps: [
      'Küçük bir sıçrayışla ayaklarını omuz genişliğinden biraz fazla aç ve aynı anda kollarını yanlardan başının üzerine kaldır.',
      'Bir sonraki sıçrayışla başlangıç pozisyonuna dön.',
      'Sabit bir ritimle devam et.',
    ],
    cues: [
      'Ayak ucuna ve yumuşak in.',
      'Yere inerken dizler hafif bükülü olsun.',
      'Sabit ritim hızdan önemli.',
      'Darbe seni rahatsız ediyorsa sıçramak yerine bir ayağını yana adımla.',
    ],
    breath: 'Düzenli nefes al; birkaç kelime konuşabiliyor olmalısın.',
    feel: 'Nabız yükselir; baldırlar, bacaklar ve omuzlar ısınır.',
    mistakes: [
      { m: 'Topuğa sert iniş.', fix: 'Ayak ucuna in ve dizini yumuşak tut.' },
      { m: 'Yere inerken dizler içe çöküyor.', fix: 'Ayaklarını daha az aç ve dizini ayak ucunla aynı yönde tut.' },
    ],
  },

  highknees: {
    why: 'Nabzı yükseltmek ve kalça bükücü kasları güçlendirmek için yoğun kardiyo.',
    setup: ['Dik dur; ayaklar kalça genişliğinde, kollar koşar gibi harekete hazır.'],
    steps: [
      'Yerinde koş ve dizlerini sırayla kalça hizasına kadar kaldır.',
      'Her bacakla birlikte karşı kolunu öne getir.',
    ],
    cues: [
      'Gövde dik kalsın; geriye yatma.',
      'Ayak ucuna in.',
      'Karın sıkı.',
      'Yorulursan hızı düşür ama diz yüksekliğini koru.',
    ],
    breath: 'Hızlı ama düzenli nefes al.',
    feel: 'Yüksek nabız, ön bacak ve karın.',
    mistakes: [
      { m: 'Gövde geriye yatıyor.', fix: 'Hafifçe öne eğil ve karnını sık.' },
      { m: 'Dizler aşağıda kalıyor.', fix: 'Daha yavaş ama tam yükseklikte.' },
      { m: 'Topuğa iniş.', fix: 'Ayağının ön kısmına ve hafifçe in.' },
    ],
  },

  climber: {
    why: 'Karın ve omuz çalışmasıyla birlikte kardiyo; plank ile koşunun birleşimi.',
    setup: [
      'Şınavın üst pozisyonu: eller omuzların altında, vücut baştan topuğa düz.',
    ],
    steps: [
      'Sağ dizini göğsüne doğru çek.',
      'Geri götür ve aynı anda sol dizini öne getir.',
      'Şınav pozisyonunda koşar gibi, ritimle devam et.',
    ],
    cues: [
      'Omuzlar ellerin üzerinde kalsın, geriye kaymasın.',
      'Kalça vücutla aynı hizada; yukarı kalkmasın.',
      'Diz göğsün altına kadar gelsin.',
      'Önce kalite, sonra hız.',
    ],
    breath: 'Düzenli nefes al; nefesini tutma.',
    feel: 'Karın, omuzlar ve yüksek nabız.',
    mistakes: [
      { m: 'Kalça yukarı kalkıyor.', fix: 'Yavaşla ve kalçanı omuz hizasında tut.' },
      { m: 'Ağırlık geriye, ayaklara kayıyor.', fix: 'Omuzlarını önde, bileklerinin üzerinde tut.' },
      { m: 'Sadece ayaklar oynuyor, diz öne gelmiyor.', fix: 'Dizini gerçekten göğsünün altına kadar getir.' },
    ],
  },

  boxing: {
    why: 'Dizleri ve eklemleri zorlamayan düşük darbeli kardiyo; omuzlar ve kor bölgesi de çalışır.',
    setup: [
      'Gard al: zayıf tarafındaki ayak önde, ayaklar omuz genişliğinde, dizler hafif bükülü.',
      'Yumruklar çenenin yanında, dirsekler vücuda yakın.',
    ],
    steps: [
      'Öndeki elinle düz bir yumruk at ve hızla geri çek.',
      'Arkadaki elinle yumruk at; aynı anda arka ayağının topuğunu ve kalçanı hafifçe çevir.',
      'Bu kombinasyonu ritimle tekrarla.',
    ],
    cues: [
      'Güç sadece koldan değil, bacaktan ve kalça dönüşünden gelsin.',
      'Her yumruktan sonra elini çenenin yanına, garda geri getir.',
      'Ayak uçlarında hafif kal.',
      'Her yumrukta kısa bir nefes ver.',
    ],
    breath: 'Her yumrukta kısa bir nefes ver; yumruklar arasında normal nefes al.',
    feel: 'Omuzlar, karın ve yükselen nabız.',
    mistakes: [
      { m: 'Yumruğun sonunda dirsek kilitleniyor.', fix: 'Dirseğini hafif bükülü tut; hayali hedefe biraz daha kısa vur.' },
      { m: 'Diğer el garddan düşüyor.', fix: 'Yumruk atmayan el hep çenenin yanında kalsın.' },
      { m: 'Vücut kaskatı ve hareketsiz.', fix: 'Dizler yumuşak olsun, kalça yumrukla birlikte dönsün.' },
    ],
  },
  /* ---------- warm-up ---------- */
  march: {
    why: 'Tüm vücudu yavaşça ısıtır ve nabzı kademeli olarak yükseltir.',
    setup: ['Dik dur, ayaklar kalça genişliğinde.'],
    steps: ['Yerinde yürü ve dizlerini kalça hizasına yakın kaldır.', 'Kollarını yürür gibi, bacaklarınla uyumlu şekilde salla.'],
    cues: ['Gövde dik, karın hafif sıkı.', 'Yavaş başla ve hızı azar azar artır.', 'Ayağının ön kısmına bas.'],
    breath: 'Normal ve düzenli.',
    feel: 'Bacaklar ısınır, nabız biraz yükselir.',
    mistakes: [{ m: 'Gövde geriye yatıyor.', fix: 'Hafifçe öne doğru dur ve karnını sıkı tut.' }],
  },
  armcircle: {
    why: 'Omuz eklemini üst vücut hareketlerine hazırlar.',
    setup: ['Dik dur, kollar vücudun yanında.'],
    steps: ['Kollarını büyük daireler çizerek çevir: önden yukarı, arkadan aşağı.', 'Sürenin yarısından sonra dönüş yönünü değiştir.'],
    cues: ['Daireler büyük ve yavaş.', 'Omuzlarını kulaklarına doğru kaldırma.', 'Bel düz; gövde kollarla birlikte sallanmasın.'],
    breath: 'Normal ve düzenli.',
    feel: 'Omuz eklemi ısınır ve rahatlar; ağrı olmadan.',
    mistakes: [{ m: 'Daireler küçük ve hızlı.', fix: 'Tam açıklıkta ve daha yavaş çevir.' }],
  },
  legswing: {
    why: 'Squat ve deadlift öncesinde kalça eklemini açar ve arka bacağı ısıtır.',
    setup: ['Duvarın yanında dur ve bir elinle destek al.', 'Tek ayak üzerinde dur; destek bacağının dizi hafif bükülü.'],
    steps: ['Serbest bacağını sarkaç gibi yavaşça öne ve arkaya salla.', 'Açıklığı azar azar artır; sonra bacak değiştir.'],
    cues: ['Gövde dik kalsın, bacakla birlikte eğilmesin.', 'Hareket yumuşak, silkelenmeden.', 'Sürenin yarısı bir bacak, yarısı diğeri.'],
    breath: 'Normal ve düzenli.',
    feel: 'Arka bacakta ve kalçanın önünde hafif bir gerilme.',
    mistakes: [{ m: 'Bacak yukarı doğru savruluyor.', fix: 'Açıklığı azalt ve yavaşça salla.' }],
  },
  catcow: {
    why: 'Omurgayı esnetir ve beli hazırlar.',
    setup: ['Dört ayak pozisyonu: eller omuzların altında, dizler kalçanın altında.'],
    steps: ['Nefes verirken sırtını kedi gibi tavana doğru yuvarla ve çeneni göğsüne yaklaştır.', 'Nefes alırken karnını yavaşça aşağı bırak, göğsünü aç ve bakışlarını hafifçe yukarı kaldır.'],
    cues: ['Hareket leğen kemiğinden başlasın ve omur omur yukarı ilerlesin.', 'Yavaş ve nefesle uyumlu.', 'Ellerin yeri itsin.'],
    breath: 'Sırtını yuvarlarken nefes ver, çukurlaştırırken nefes al.',
    feel: 'Bel ve kürek kemiklerinin arası rahatlar.',
    mistakes: [{ m: 'Fazla ve zorlayarak yapılan bel çukuru.', fix: 'Açıklığı azalt; sadece rahat olduğun yere kadar git.' }],
  },

  /* ---------- cool-down ---------- */
  hamstretch: {
    why: 'Antrenman sonrası arka bacaktaki sertliği azaltır.',
    setup: ['Dik dur, dizler hafif bükülü ve yumuşak.'],
    steps: ['Kalçadan öne eğil ve kollarını ayaklarına doğru sarkıt.', 'Hafif bir gerilme hissettiğin yerde dur ve bekle.'],
    cues: ['Belden değil, kalçadan eğil.', 'Gerilme hafif olmalı, ağrı değil.', 'Her nefes verişte biraz daha gevşe.'],
    breath: 'Sakin ve derin; nefesini tutma.',
    feel: 'Arka bacakta hafif bir gerilme.',
    mistakes: [{ m: 'Daha aşağı inmek için yaylanmak.', fix: 'Sabit kal ve sadece nefesle gevşe.' }],
  },
  quadstretch: {
    why: 'Alt vücut hareketlerinden sonra ön bacağı ve kalçanın önünü esnetir.',
    setup: ['Duvarın yanında dur ve bir elinle destek al.'],
    steps: ['Bir bacağını bük ve ayak bileğini aynı taraftaki elinle tut.', 'Topuğunu kalçana doğru çek ve dizlerini yan yana tut.', 'Sürenin yarısı kadar bekle, sonra bacak değiştir.'],
    cues: ['Dizler yan yana; bükülü diz öne çıkmasın.', 'Gerilmeyi artırmak için kalçanı hafifçe sık.', 'Gövde dik.'],
    breath: 'Sakin ve derin.',
    feel: 'Ön bacakta ve kalçanın önünde gerilme.',
    mistakes: [{ m: 'Bel çukurlaşıyor.', fix: 'Karnını sık ve leğen kemiğini hafifçe öne getir.' }],
    safety: 'Diz ağrın varsa bu esnetmeyi yan yatarak yap.',
  },
  chestopen: {
    why: 'Göğsü ve omuzların önünü açar; özellikle itiş hareketlerinden ya da masa başında oturduktan sonra.',
    setup: ['Dik dur, ellerini arkanda kenetle.'],
    steps: ['Kenetli ellerini yavaşça geriye ve aşağıya götür.', 'Kürek kemiklerini birbirine yaklaştır ve göğsünü aç; bekle.'],
    cues: ['Omuzlar aşağıda ve kulaklardan uzak.', 'Bel çukurlaşmasın.', 'Hafif bir gerilme.'],
    breath: 'Sakin ve derin.',
    feel: 'Göğsün ve omuzların önünde gerilme.',
    mistakes: [{ m: 'Baş öne gidiyor.', fix: 'Boynun düz olsun diye çeneni hafifçe geriye çek.' }],
  },
  childpose: {
    why: 'Seansın sonunda bel ve kalça için aktif dinlenme.',
    setup: ['Dizlerinin üzerine otur; ayak başparmakları birbirine yakın, dizler hafif açık.'],
    steps: ['Kalçanı topuklarının üzerine oturt.', 'Gövdeni öne götür ve kollarını yerde ileriye uzat.', 'Alnını yere koy ve bekle.'],
    cues: ['Omuzlarını serbest bırak.', 'Her nefes verişte kalçanı biraz daha geriye götür.', 'Boyun tamamen gevşek.'],
    breath: 'Sakin ve derin; nefesini sırtına ve yanlarına gönder.',
    feel: 'Belde, kalçada ve koltuk altlarında hafif bir gerilme.',
    mistakes: [{ m: 'Kalça topukların üzerine oturmuyor.', fix: 'Kalçanla topukların arasına bir yastık koy.' }],
    safety: 'Diz ağrın varsa bu hareketi atla ya da dizlerinin altına yastık koy.',
  },
};
