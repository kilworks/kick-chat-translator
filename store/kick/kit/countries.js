// Shared by partner-kit.html and email/panels.html.
// Country, ISO 3166 alpha-2, ISO numeric (world-atlas id), continent, installs since 5 Jun, weekly users 1 Nov.
// From the Chrome Web Store dashboard CSV exports (installs and weekly users by region), read 2 Nov 2026.
const C = [
  ['United States','US',840,'North America',250,73], ['Romania','RO',642,'Europe',41,0], ['Japan','JP',392,'Asia',30,18],
  ['Turkey','TR',792,'Europe',27,13], ['Poland','PL',616,'Europe',16,11], ['Germany','DE',276,'Europe',12,5],
  ['Argentina','AR',32,'South America',12,5], ['Brazil','BR',76,'South America',12,9], ['Canada','CA',124,'North America',10,5],
  ['Russia','RU',643,'Europe',10,5], ['Peru','PE',604,'South America',7,4], ['Australia','AU',36,'Oceania',6,1],
  ['United Kingdom','GB',826,'Europe',5,4], ['Thailand','TH',764,'Asia',5,3], ['Spain','ES',724,'Europe',4,3],
  ['India','IN',356,'Asia',4,5], ['Norway','NO',578,'Europe',4,4], ['Ukraine','UA',804,'Europe',4,4],
  ['South Korea','KR',410,'Asia',3,3], ['France','FR',250,'Europe',3,1], ['Israel','IL',376,'Asia',3,3],
  ['Czechia','CZ',203,'Europe',3,2], ['Singapore','SG',702,'Asia',3,2], ['Taiwan','TW',158,'Asia',3,2],
  ['Ecuador','EC',218,'South America',3,2], ['South Africa','ZA',710,'Africa',2,0], ['Chile','CL',152,'South America',2,2],
  ['Iraq','IQ',368,'Asia',2,1], ['Slovakia','SK',703,'Europe',2,1], ['Sweden','SE',752,'Europe',2,1],
  ['Egypt','EG',818,'Africa',2,1], ['Saudi Arabia','SA',682,'Asia',1,1], ['Austria','AT',40,'Europe',1,1],
  ['Belgium','BE',56,'Europe',1,0], ['Bolivia','BO',68,'South America',1,1], ['Bulgaria','BG',100,'Europe',1,1],
  ['Cambodia','KH',116,'Asia',1,0], ['Cyprus','CY',196,'Europe',1,0], ['Colombia','CO',170,'South America',1,0],
  ['Costa Rica','CR',188,'North America',1,1], ['Honduras','HN',340,'North America',1,1], ['Hong Kong','HK',344,'Asia',1,1],
  ['Indonesia','ID',360,'Asia',1,0], ['Italy','IT',380,'Europe',1,1], ['Lithuania','LT',440,'Europe',1,1],
  ['Malaysia','MY',458,'Asia',1,0], ['Morocco','MA',504,'Africa',1,1], ['Mexico','MX',484,'North America',1,1],
  ['Pakistan','PK',586,'Asia',1,0], ['Paraguay','PY',600,'South America',1,1], ['Philippines','PH',608,'Asia',1,0],
  ['Portugal','PT',620,'Europe',1,0], ['Dominican Rep.','DO',214,'North America',1,1], ['Switzerland','CH',756,'Europe',1,1],
  ['Venezuela','VE',862,'South America',1,0], ['China','CN',156,'Asia',0,1], ['Nigeria','NG',566,'Africa',0,1],
  ['Netherlands','NL',528,'Europe',0,1],
];
// Self-check against the CSV totals: 58 countries, 516 installs with a known country, 210 weekly users.
const sum = i => C.reduce((s, c) => s + c[i], 0);
window.__check = { countries: C.length, installs: sum(4), weekly: sum(5),
  continents: [...new Set(C.map(c => c[3]))].length, ok: C.length === 58 && sum(4) === 516 && sum(5) === 210 };

