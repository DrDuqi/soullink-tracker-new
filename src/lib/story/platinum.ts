import type { Story } from './types'

// Seed content: Pokémon Platin, Sinnoh — early game (Zweiblattdorf → Ewigenau).
// Beta data, easily extended chapter-by-chapter. Levels are approximate for
// Platin; route names match the app's Sinnoh route list for encounter cross-checks.
export const platinum: Story = {
  game: 'platinum',
  label: 'Pokémon Platin',
  region: 'Sinnoh',
  chapters: [
    {
      id: 'zweiblattdorf', title: 'Zweiblattdorf', kind: 'town',
      locations: ['Zweiblattdorf', 'Twinleaf Town', 'Twinleaf'],
      goal: 'Fang dein erstes Pokémon und erreiche Sandgemmenstadt.',
      recommendedLevel: [5, 6],
      todos: ['Mit dem Rivalen zum See', 'Starter aus Prof. Eibes Koffer wählen', 'Nach Sandgemmenstadt reisen'],
      items: [{ name: 'Trank', note: 'Im eigenen Haus' }],
      encounters: ['Route 201'],
    },
    {
      id: 'sandgemmenstadt', title: 'Sandgemmenstadt', kind: 'town',
      locations: ['Sandgemmenstadt', 'Sandgem Town', 'Sandgem'],
      goal: 'Hol dir den Pokédex von Prof. Eibe.',
      recommendedLevel: [5, 7],
      todos: ['Pokédex von Prof. Eibe erhalten', '5 Pokébälle abholen', 'Über Route 202 nach Jubelstadt'],
      items: [{ name: '5× Pokéball', note: 'Von Eibes Assistent' }, { name: 'Stadtplan' }],
      encounters: ['Route 201', 'Route 202'],
    },
    {
      id: 'jubelstadt', title: 'Jubelstadt', kind: 'town',
      locations: ['Jubelstadt', 'Jubilife City', 'Jubilife'],
      goal: 'Erhalte die Pokétch-Uhr und besiege deinen Rivalen.',
      recommendedLevel: [7, 9],
      todos: ['3 Coupons der Klettermaxe-Werbung sammeln', 'Pokétch abholen', 'Rivalenkampf gewinnen', 'TM kostenlos in der TV-Station holen'],
      trainers: [{ name: 'Rivale', title: 'Freundschaftskampf', team: [{ name: 'Staralili', level: 8 }, { name: 'Starter', level: 9 }] }],
      items: [{ name: 'Pokétch' }, { name: 'Beutel (Charm)' }],
      hiddenItems: [{ name: 'Versteckter Trank' }],
      encounters: ['Route 202', 'Route 203'],
    },
    {
      id: 'route203-erzbergwerk', title: 'Route 203 & Erzbergwerk', kind: 'cave',
      locations: ['Route 203', 'Erzbergwerk', 'Oreburgh-Mine', 'Oreburgh Mine', 'Oreburgh Gate'],
      goal: 'Durchquere das Erzbergwerk und erreiche Erzelingen.',
      recommendedLevel: [9, 12],
      todos: ['Trainer auf Route 203 besiegen', 'Erzbergwerk (Oreburgh-Mine) durchqueren', 'Veit in der Mine finden', 'VM Stärke-Helfer / Items einsammeln'],
      items: [{ name: 'Fluchtseil' }, { name: 'TM auf Route 203' }],
      hiddenItems: [{ name: 'Versteckter Äther (Mine)' }],
      encounters: ['Route 203', 'Oreburgh-Mine'],
    },
    {
      id: 'arena-erzelingen', title: 'Arena Erzelingen', kind: 'gym',
      locations: ['Erzelingen', 'Oreburgh City', 'Oreburgh', 'Arena Erzelingen', 'Oreburgh Gym'],
      goal: 'Besiege Arenaleiter Veit und gewinne den Kohle-Orden.',
      recommendedLevel: [12, 14],
      todos: ['Arena Erzelingen betreten', 'Veit besiegen', 'Kohle-Orden erhalten', 'TM Steinwurf abholen'],
      trainers: [
        { name: 'Veit', title: 'Arenaleiter · Gestein', danger: true, team: [{ name: 'Geowaz', level: 12 }, { name: 'Onix', level: 12 }, { name: 'Koknodon', level: 14 }] },
      ],
      gym: {
        leader: 'Veit', type: 'Gestein', badge: 'Kohle-Orden',
        recommendedTypes: ['Wasser', 'Pflanze', 'Kampf', 'Boden', 'Stahl'],
        dangerMons: ['Koknodon (Lv14) – Kopfnuss trifft hart'],
        keyMoves: ['Steinwurf', 'Kopfnuss'],
      },
    },
    {
      id: 'route204-ewigwald', title: 'Route 204 & Ewig-Wald', kind: 'forest',
      locations: ['Route 204', 'Ewig-Wald', 'Eterna Forest', 'Route 205'],
      goal: 'Reise durch den Ewig-Wald nach Ewigenau.',
      recommendedLevel: [13, 16],
      todos: ['Route 204 & 205 erkunden', 'Mit Aromrandom durch den Ewig-Wald', 'Galaktik-Rüpel auf dem Weg besiegen'],
      items: [{ name: 'TM Schleuder' }, { name: 'Diverse Tränke' }],
      hiddenItems: [{ name: 'Verstecktes Sonderbonbon (Route 204)' }],
      encounters: ['Route 204', 'Route 205', 'Ewig-Wald'],
    },
    {
      id: 'arena-ewigenau', title: 'Arena Ewigenau', kind: 'gym',
      locations: ['Ewigenau', 'Eterna City', 'Eterna', 'Arena Ewigenau', 'Eterna Gym'],
      goal: 'Besiege Hardy und gewinne den Wald-Orden.',
      recommendedLevel: [18, 22],
      todos: ['Fahrrad im Fahrradladen holen', 'Arena Ewigenau lösen (Drehtüren)', 'Hardy besiegen', 'Wald-Orden erhalten'],
      trainers: [
        { name: 'Hardy', title: 'Arenaleiterin · Pflanze', danger: true, team: [{ name: 'Sarzenia', level: 20 }, { name: 'Knofensa', level: 20 }, { name: 'Roserade', level: 22 }] },
      ],
      gym: {
        leader: 'Hardy', type: 'Pflanze', badge: 'Wald-Orden',
        recommendedTypes: ['Feuer', 'Flug', 'Eis', 'Käfer', 'Gift'],
        dangerMons: ['Roserade (Lv22) – Gigasauger & Giftspitzen'],
        keyMoves: ['Rasierblatt', 'Gigasauger', 'Aromakur'],
      },
    },
  ],
}
