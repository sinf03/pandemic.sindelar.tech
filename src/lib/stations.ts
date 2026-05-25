/**
 * Definitions of the five physical stations (Laboratoř, Centrála, Sklad, Pole,
 * Karanténní stanice). Each entry maps to a route under `/station/[code]/[key]`
 * that runs on a shared tablet/computer at the spot.
 *
 * The `disease` field on cure stations tells the API which cure to advance when
 * a task is completed. Karanténa is a self-heal station — it has no cure
 * mapping; the page asks for a player + disease at confirmation time.
 */
import type { DiseaseKey } from '$lib/supabase/types';

export type StationKey = 'lab' | 'centrala' | 'sklad' | 'pole' | 'karantena';

export type SimpleTask = {
	id: string;
	title: string;
	body: string;
};

export type AnsweredTask = SimpleTask & {
	answer: string;
	hint?: string;
};

export type CureStation = {
	key: Exclude<StationKey, 'karantena'>;
	name: string;
	subtitle: string;
	disease: DiseaseKey;
	accent: string;
	tasks: SimpleTask[];
};

export type AnsweredStation = {
	key: 'centrala';
	name: string;
	subtitle: string;
	disease: DiseaseKey;
	accent: string;
	tasks: AnsweredTask[];
};

export type QuarantineStation = {
	key: 'karantena';
	name: string;
	subtitle: string;
	accent: string;
	tasks: SimpleTask[];
};

export type Station = CureStation | AnsweredStation | QuarantineStation;

/** Loose comparator: trim, lowercase, strip diacritics, drop non-alphanumerics. */
export function normalizeAnswer(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

export function answerMatches(input: string, expected: string): boolean {
	return normalizeAnswer(input) === normalizeAnswer(expected);
}

const lab: CureStation = {
	key: 'lab',
	name: 'Laboratoř',
	subtitle: 'Lék pro Rubru (Rudý kašel) — fyzická síla a vůle.',
	disease: 'rubra',
	accent: 'rubra',
	tasks: [
		{
			id: 'lab-1',
			title: '30 burpees v jednom kuse',
			body: 'Bez pauzy. Pokud potřebuješ dýchat, musíš začít znovu od nuly.'
		},
		{
			id: 'lab-2',
			title: '50 dřepů s rukama nad hlavou',
			body: 'Ruce spojené dlaněmi nad hlavou, nezvedat se ze špiček. Plynule.'
		},
		{
			id: 'lab-3',
			title: 'Plank 2 minuty',
			body: 'Předloktí na zemi, tělo v jedné rovině. Bez prohnuté páteře.'
		},
		{
			id: 'lab-4',
			title: '25 kliků s pauzou dole',
			body: 'V dolní poloze drž 3 vteřiny než se vytlačíš nahoru. Lokty u těla.'
		},
		{
			id: 'lab-5',
			title: '40 výponů na špičky s batohem',
			body: 'V rukou drž batoh / dva litry vody. Plný rozsah pohybu.'
		},
		{
			id: 'lab-6',
			title: '60 vteřin mountain climbers',
			body: 'Sprintové tempo, bez polevení. Vedoucí měří stopkami.'
		},
		{
			id: 'lab-7',
			title: '50× přes švihadlo bez chyby',
			body: 'Když škobrtneš, počítej znovu od nuly. Dvakrát chytrácká = znovu.'
		},
		{
			id: 'lab-8',
			title: 'Wall sit 90 vteřin',
			body: 'Záda u zdi, stehna rovnoběžně se zemí. Žádné opírání rukama.'
		},
		{
			id: 'lab-9',
			title: '20 sklapovaček s nataženýma nohama',
			body: 'Ruce za hlavou, lopatky se dotýkají kolen v horní poloze.'
		},
		{
			id: 'lab-10',
			title: 'Trojboj 15-15-15',
			body: '15 kliků → 15 dřepů → 15 burpees, bez pauzy mezi cviky.'
		},
		{
			id: 'lab-11',
			title: '40× step-up na lavičku',
			body: 'Střídej nohy. Lavička / schod min. 30 cm vysoký.'
		}
	]
};

const centrala: AnsweredStation = {
	key: 'centrala',
	name: 'Centrála',
	subtitle: 'Lék pro Viridis (Zelená horečka) — hlavolamy a šifry.',
	disease: 'viridis',
	accent: 'viridis',
	tasks: [
		{
			id: 'centrala-1',
			title: 'Anagram',
			body: 'Z písmen A I K M O Z A poskládej běžné české slovo (7 písmen).',
			answer: 'mozaika'
		},
		{
			id: 'centrala-2',
			title: 'Caesarova šifra (-3)',
			body: 'Dešifruj posunutím o 3 zpět v abecedě: YLUXV.',
			answer: 'virus'
		},
		{
			id: 'centrala-3',
			title: 'Morseova abeceda',
			body: 'Přepiš do písmen: ... --- ...',
			answer: 'sos'
		},
		{
			id: 'centrala-4',
			title: 'Logická úloha',
			body: 'Mám stejně tolik bratrů jako sester. Moje sestra má dvakrát víc bratrů než sester. Kolik nás je celkem?',
			answer: '7',
			hint: '4 bratři + 3 sestry'
		},
		{
			id: 'centrala-5',
			title: 'Look-and-say',
			body: 'Pokračuj v posloupnosti: 1, 11, 21, 1211, 111221, ?',
			answer: '312211'
		},
		{
			id: 'centrala-6',
			title: 'Hádanka',
			body: 'Co se neustále zvětšuje, ale nikdy se nezmenšuje?',
			answer: 'věk'
		},
		{
			id: 'centrala-7',
			title: 'Hádanka II',
			body: 'Co má dno, ale stojí to na hlavě?',
			answer: 'palec'
		},
		{
			id: 'centrala-8',
			title: 'Číselná řada',
			body: 'Jaké je další číslo: 3, 7, 15, 31, 63, ?',
			answer: '127',
			hint: 'každé další = předchozí ×2 + 1'
		},
		{
			id: 'centrala-9',
			title: 'Slovní hádanka',
			body: 'Co má klíče, ale neotevírá zámky, má prostor, ale není místnost?',
			answer: 'klávesnice'
		},
		{
			id: 'centrala-10',
			title: 'Násobilka pod tlakem',
			body: 'Které kladné číslo se rovná 13, pokud jeho druhá mocnina je 169?',
			answer: '13'
		},
		{
			id: 'centrala-11',
			title: 'Římské číslice',
			body: 'Jaké číslo zapíšeme jako MCMXCIV?',
			answer: '1994'
		}
	]
};

const sklad: CureStation = {
	key: 'sklad',
	name: 'Sklad',
	subtitle: 'Lék pro Nox (Černý stín) — tvořivost a originalita.',
	disease: 'nox',
	accent: 'nox',
	tasks: [
		{
			id: 'sklad-1',
			title: 'Mapa klubovny z paměti',
			body: 'Nakresli na A4 půdorys klubovny včetně všech dveří a oken. Bez chození ven.'
		},
		{
			id: 'sklad-2',
			title: '8řádková báseň o pandemii',
			body: 'Rýmovaná, vlastní. Vedoucí přečte a posoudí.'
		},
		{
			id: 'sklad-3',
			title: 'Vymysli krizovou kartu',
			body: 'Napiš název, popis, a dvě varianty řešení s jejich důsledky.'
		},
		{
			id: 'sklad-4',
			title: 'Origami zvíře',
			body: 'Z papíru u stanice slož libovolné zvíře. Musí být rozpoznatelné.'
		},
		{
			id: 'sklad-5',
			title: 'Portrét spoluhráče',
			body: 'Nakresli někoho z týmu. Vedoucí musí uhodnout koho.'
		},
		{
			id: 'sklad-6',
			title: 'Improvizovaná scénka (90 s)',
			body: '„Tisková konference o úniku patogenu" — sám nebo s parťákem. Vedoucí měří čas.'
		},
		{
			id: 'sklad-7',
			title: 'Slogan WHO kampaně',
			body: 'Vymysli slogan proti Černému stínu, min. 8 slov, musí mít rým nebo rytmus.'
		},
		{
			id: 'sklad-8',
			title: 'Papírové letadlo na 3 m',
			body: 'Sestav z papíru a kancelářské sponky letadlo, které doletí přesně 3 metry.'
		},
		{
			id: 'sklad-9',
			title: 'Recept na fiktivní lék',
			body: 'Napiš ingredience (min. 5), postup, dávkování a vedlejší účinky.'
		},
		{
			id: 'sklad-10',
			title: 'Komiks o 4 panelech',
			body: 'Tým poráží pandemii. Musí být čitelná zápletka a pointa.'
		},
		{
			id: 'sklad-11',
			title: 'Totem z 10 předmětů',
			body: 'Naskládej totem aspoň 30 cm vysoký. Musí přežít lehké ťuknutí prstem.'
		}
	]
};

const pole: CureStation = {
	key: 'pole',
	name: 'Pole',
	subtitle: 'Lék pro Aurum (Zlatá zimnice) — běh, vzduch, mapy.',
	disease: 'aurum',
	accent: 'aurum',
	tasks: [
		{
			id: 'pole-1',
			title: 'Sprint 100 m venku',
			body: 'Zaznamenej v Mapách / běžecké aplikaci. Ukaž vedoucímu trasu.'
		},
		{
			id: 'pole-2',
			title: '500 m venku v jednom kuse',
			body: 'Trasa musí být v Mapách. Tempo nezáleží, ale bez chůze.'
		},
		{
			id: 'pole-3',
			title: '5 minut běhu venku',
			body: 'Měř časem v telefonu. Vedoucí kontroluje stopky a screenshot.'
		},
		{
			id: 'pole-4',
			title: '50 schodů běžecky',
			body: 'Najdi schodiště venku, nahoru-dolů, dokud nedáš 50 stoupání. Bez kočičího kroku.'
		},
		{
			id: 'pole-5',
			title: '5× sprint 20 m',
			body: 'Mezi dvěma stromy / sloupy. Bez pauzy mezi sprinty.'
		},
		{
			id: 'pole-6',
			title: '10 okruhů klubovny uvnitř',
			body: 'Plné tempo, pokud někoho potkáš, vyhneš se. Vedoucí počítá.'
		},
		{
			id: 'pole-7',
			title: '5 minut běhu uvnitř',
			body: 'Klubovna, chodby, schody — pohyb musí být plynulý. Žádné odpočinky.'
		},
		{
			id: 'pole-8',
			title: 'Štafeta dopravních značek',
			body: 'Najdi venku 3 různé dopravní značky a oběhni strom mezi nimi. Trasa v Mapách.'
		},
		{
			id: 'pole-9',
			title: '10× skok do dálky za sebou',
			body: 'Změř celkovou vzdálenost ze startu po poslední dopad. Min. 12 m součet.'
		},
		{
			id: 'pole-10',
			title: '1 km na čerstvém vzduchu',
			body: 'Mapy / Strava / Runtastic — screenshot s trasou ukáže vedoucímu.'
		},
		{
			id: 'pole-11',
			title: 'Skok do dálky — 3 pokusy',
			body: 'Vedoucí změří nejlepší pokus. Hodnotí se technika.'
		}
	]
};

const karantena: QuarantineStation = {
	key: 'karantena',
	name: 'Karanténní stanice',
	subtitle: 'Vyléčení sebe — tělo + hlava. Sníží ti tvoji vlastní nákazu o 1 stupeň.',
	accent: 'viridis',
	tasks: [
		{
			id: 'karantena-1',
			title: '50 kliků + krátká reflexe',
			body: 'Po sérii napiš jednou větou na papír, čeho se dnes bojíš.'
		},
		{
			id: 'karantena-2',
			title: 'Plank 90 s + sdílení',
			body: 'Po skončení řekni vedoucímu, co tě v posledních dnech vykolejilo.'
		},
		{
			id: 'karantena-3',
			title: '100 dřepů + sebehodnocení',
			body: 'Můžeš rozdělit do sérií. Pak popiš jednu věc, kterou bys u sebe zlepšil.'
		},
		{
			id: 'karantena-4',
			title: '30 burpees + uznání',
			body: 'Vyjmenuj 3 lidi z týmu, kterých si dnes vážíš, a proč.'
		},
		{
			id: 'karantena-5',
			title: 'Plank bočně 2× 45 s + dech',
			body: 'Pak zavři oči na 60 vteřin a soustřeď se jen na dech. Hlasitě počítej nádechy.'
		},
		{
			id: 'karantena-6',
			title: '20 přítahů (nebo náhrada) + rozhodnutí',
			body: 'Popiš vedoucímu nejtěžší rozhodnutí, které jsi dnes ve hře udělal.'
		},
		{
			id: 'karantena-7',
			title: '60 sklapovaček + silná stránka',
			body: 'Napiš 3 věty o tom, v čem jsi dobrý a co to týmu přináší.'
		},
		{
			id: 'karantena-8',
			title: '5 minut izolace bez telefonu',
			body: 'Sedni si do rohu, žádný telefon, žádná konverzace. Pak řekni vedoucímu, na co jsi přišel.'
		},
		{
			id: 'karantena-9',
			title: 'Wall sit 2 minuty + návyk',
			body: 'Po cviku pojmenuj 1 svůj návyk, který chceš změnit, a jak na něj půjdeš.'
		},
		{
			id: 'karantena-10',
			title: '200× švihadlo + denní rutina',
			body: 'Po cviku napiš svoji ideální denní rutinu v 5 bodech.'
		},
		{
			id: 'karantena-11',
			title: '50 burpees + motivace týmu',
			body: 'Po skončení řekni týmu, proč chceš, abyste vyhráli. Hlasitě, beze studu.'
		}
	]
};

export const STATIONS: Record<StationKey, Station> = {
	lab,
	centrala,
	sklad,
	pole,
	karantena
};

export const STATION_ORDER: StationKey[] = ['lab', 'centrala', 'sklad', 'pole', 'karantena'];

export function isStationKey(s: string): s is StationKey {
	return STATION_ORDER.includes(s as StationKey);
}
