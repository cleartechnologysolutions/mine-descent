// Curated mine networks. Coordinates are grid cells; every portal joins
// face-adjacent rooms exactly 50 units apart. Explicit links permit solid
// walls between neighboring but unconnected rooms.
const layouts = [
  {
    name: 'IRON HOLLOW',
    coreRoom: 9,
    cells: [
      [0,0,0], [0,0,-1], [1,0,-1], [1,1,-1], [1,1,-2],
      [2,1,-2], [2,1,-3], [2,0,-3], [3,0,-3], [3,0,-4],
      [-1,0,-1], [-1,0,-2], [0,0,-2], [-1,1,-2], [-1,2,-2],
      [1,2,-1], [2,2,-2], [3,2,-2]
    ],
    branchLinks: [[1,10],[10,11],[11,12],[12,1],[11,13],[13,14],[3,15],[5,16],[16,17]],
    cacheRooms: [14,17],
    resupplyRooms: [2,15,16,7]
  },
  {
    name: 'FRACTURE WORKS',
    coreRoom: 11,
    cells: [
      [0,0,0], [0,0,-1], [-1,0,-1], [-1,-1,-1], [-1,-1,-2],
      [-2,-1,-2], [-2,0,-2], [-2,0,-3], [-2,1,-3], [-1,1,-3],
      [-1,1,-4], [-1,2,-4],
      [1,0,-1], [1,0,-2], [0,0,-2], [1,1,-2], [1,1,-3],
      [1,2,-3], [-1,-2,-2], [-2,-2,-2], [-3,0,-2], [-3,1,-2],
      [-3,1,-3], [-1,0,-4]
    ],
    branchLinks: [[1,12],[12,13],[13,14],[14,1],[13,15],[15,16],[16,17],[4,18],[18,19],[19,5],[6,20],[20,21],[21,22],[22,8],[10,23]],
    cacheRooms: [17,23],
    resupplyRooms: [2,18,21,9]
  },
  {
    name: 'HELIX CORE',
    coreRoom: 13,
    cells: [
      [0,0,0], [0,0,-1], [0,1,-1], [1,1,-1], [1,1,-2],
      [1,2,-2], [2,2,-2], [2,2,-3], [2,1,-3], [2,1,-4],
      [3,1,-4], [3,0,-4], [3,0,-5], [3,-1,-5],
      [-1,0,-1], [-1,1,-1], [-2,1,-1], [-2,1,-2], [-2,0,-2],
      [1,0,-2], [1,-1,-2], [1,-1,-3], [0,-1,-3],
      [0,2,-2], [0,2,-3], [1,2,-3], [3,2,-4], [4,2,-4],
      [4,1,-4], [3,0,-6]
    ],
    branchLinks: [[1,14],[14,15],[15,2],[15,16],[16,17],[17,18],[4,19],[19,20],[20,21],[21,22],[5,23],[23,24],[24,25],[25,5],[25,7],[10,26],[26,27],[27,28],[28,10],[12,29]],
    cacheRooms: [18,22,29],
    resupplyRooms: [3,19,24,28,11]
  }
];

// Local identities and the single keyed entrance to each reactor wing.
const identities = [
  {
    "codePrefix": "IH",
    "reactorGate": [
      3,
      4
    ],
    "keyRoom": 14,
    "reactorWing": [
      4,
      5,
      6,
      7,
      8,
      9,
      16,
      17
    ],
    "shieldRooms": [
      15,
      7
    ],
    "roomIdentity": [
      [
        "Docking Cradle",
        "intake"
      ],
      [
        "Ore Junction",
        "crusher"
      ],
      [
        "Freight Sump",
        "freight"
      ],
      [
        "Main Switch House",
        "switchgear"
      ],
      [
        "Primary Coolant",
        "coolant"
      ],
      [
        "Generator Gallery",
        "turbine"
      ],
      [
        "Thermal Return",
        "foundry"
      ],
      [
        "Pump Reservoir",
        "coolant"
      ],
      [
        "Field Regulator",
        "switchgear"
      ],
      [
        "Hollow Reactor",
        "containment"
      ],
      [
        "North Ore Bins",
        "ore"
      ],
      [
        "Cutter Workshop",
        "workshop"
      ],
      [
        "Recirculation Blower",
        "turbine"
      ],
      [
        "Cooling Riser",
        "coolant"
      ],
      [
        "Shift Control",
        "switchgear"
      ],
      [
        "Hoist Drum",
        "freight"
      ],
      [
        "Busbar Loft",
        "switchgear"
      ],
      [
        "Seal Store",
        "freight"
      ]
    ]
  },
  {
    "codePrefix": "FW",
    "reactorGate": [
      5,
      6
    ],
    "keyRoom": 17,
    "reactorWing": [
      6,
      7,
      8,
      9,
      10,
      11,
      20,
      21,
      22,
      23
    ],
    "shieldRooms": [
      18,
      9
    ],
    "roomIdentity": [
      [
        "Drop Dock",
        "intake"
      ],
      [
        "Transfer Hub",
        "freight"
      ],
      [
        "Jaw Mill",
        "crusher"
      ],
      [
        "Slag Drop",
        "foundry"
      ],
      [
        "Cutter Works",
        "workshop"
      ],
      [
        "Primary Switch",
        "switchgear"
      ],
      [
        "Coolant Intake",
        "coolant"
      ],
      [
        "Impeller Hall",
        "turbine"
      ],
      [
        "Reactor Switch Yard",
        "switchgear"
      ],
      [
        "Heat Exchanger",
        "foundry"
      ],
      [
        "Quench Manifold",
        "coolant"
      ],
      [
        "Fracture Reactor",
        "containment"
      ],
      [
        "Ore Counterweight",
        "ore"
      ],
      [
        "Survey Workshop",
        "workshop"
      ],
      [
        "Return Blower",
        "turbine"
      ],
      [
        "Dry Cargo Loft",
        "freight"
      ],
      [
        "Ventilation Crown",
        "turbine"
      ],
      [
        "Supervisors Office",
        "switchgear"
      ],
      [
        "Dust Separator",
        "ore"
      ],
      [
        "Turbine Bypass",
        "turbine"
      ],
      [
        "Cooling Store",
        "freight"
      ],
      [
        "Drain Pump",
        "coolant"
      ],
      [
        "Relay Workshop",
        "workshop"
      ],
      [
        "Emergency Stores",
        "freight"
      ]
    ]
  },
  {
    "codePrefix": "HC",
    "reactorGate": [
      7,
      8
    ],
    "keyRoom": 22,
    "reactorWing": [
      8,
      9,
      10,
      11,
      12,
      13,
      26,
      27,
      28,
      29
    ],
    "shieldRooms": [
      19,
      28
    ],
    "roomIdentity": [
      [
        "Docking Caisson",
        "intake"
      ],
      [
        "Ore Intake",
        "ore"
      ],
      [
        "Lift Mechanics",
        "workshop"
      ],
      [
        "Jaw Alignment",
        "crusher"
      ],
      [
        "Transfer Node",
        "freight"
      ],
      [
        "Borehead Switch",
        "switchgear"
      ],
      [
        "Cutter Crown",
        "crusher"
      ],
      [
        "Thermal Feed",
        "foundry"
      ],
      [
        "Primary Pump",
        "coolant"
      ],
      [
        "Dynamo Gallery",
        "turbine"
      ],
      [
        "Field Control",
        "switchgear"
      ],
      [
        "Hotwell Return",
        "foundry"
      ],
      [
        "Pressure Lock",
        "coolant"
      ],
      [
        "Helix Reactor",
        "containment"
      ],
      [
        "Cable Exchange",
        "switchgear"
      ],
      [
        "Service Gantry",
        "freight"
      ],
      [
        "Dust Mill",
        "crusher"
      ],
      [
        "Filter Pumps",
        "coolant"
      ],
      [
        "Abandoned Dispatch",
        "switchgear"
      ],
      [
        "Rail Service",
        "workshop"
      ],
      [
        "Lower Ore Bins",
        "ore"
      ],
      [
        "Exhaust Impeller",
        "turbine"
      ],
      [
        "Crew Control",
        "switchgear"
      ],
      [
        "Freight Return",
        "freight"
      ],
      [
        "Air Scrubbers",
        "turbine"
      ],
      [
        "Coolant Header",
        "coolant"
      ],
      [
        "Dynamo Parts",
        "freight"
      ],
      [
        "Capacitor Service",
        "workshop"
      ],
      [
        "Standby Blower",
        "turbine"
      ],
      [
        "Emergency Reserve",
        "freight"
      ]
    ]
  }
];

export function graphDistances(roomCount, links, start) {
  const distances = Array(roomCount).fill(Infinity), queue = [start];
  distances[start] = 0;
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const [a,b] of links) {
      const neighbor = a === current ? b : b === current ? a : -1;
      if (neighbor >= 0 && distances[neighbor] === Infinity) {
        distances[neighbor] = distances[current] + 1;
        queue.push(neighbor);
      }
    }
  }
  return distances;
}

export function makeMineLayout(index) {
  const layout = layouts[index];
  if (!layout) throw new RangeError('Unknown mine level');
  const identity = identities[index];
  const coords = layout.cells.map(cell => cell.map(n => n * 50));
  const links = [
    ...Array.from({length:layout.coreRoom}, (_,i) => [i,i+1]),
    ...layout.branchLinks.map(pair => [...pair])
  ];
  return {
    name: layout.name,
    reactorGate: [...identity.reactorGate],
    keyRoom: identity.keyRoom,
    reactorWing: [...identity.reactorWing],
    shieldRooms: [...identity.shieldRooms],
    roomIdentity: identity.roomIdentity.map(([name,theme],i)=>({name,theme,code:identity.codePrefix+'-'+String(i+1).padStart(2,'0')})),
    coords,
    links,
    coreRoom: layout.coreRoom,
    roomDepth: graphDistances(coords.length, links, 0),
    distanceToCore: graphDistances(coords.length, links, layout.coreRoom),
    cacheRooms: [...layout.cacheRooms],
    resupplyRooms: [...layout.resupplyRooms]
  };
}

// Sound follows the connected passages, never straight through a neighboring wall.
// Position is in world units. No distance or directional waypoint is shown to pilots.
export function reactorSignal(layout, position) {
  if (!layout) return 0;
  const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
  let nearest=0;
  for(let i=1;i<layout.coords.length;i++)if(distance(position,layout.coords[i])<distance(position,layout.coords[nearest]))nearest=i;
  if(!layout.reactorWing.includes(nearest))return 0;
  let routeDistance;
  for(const [a,b]of layout.links){
    const start=layout.coords[a],end=layout.coords[b],axis=start.findIndex((n,i)=>n!==end[i]);
    const t=(position[axis]-start[axis])/(end[axis]-start[axis]);
    if(t<.32||t>.68||[0,1,2].some(i=>i!==axis&&Math.abs(position[i]-start[i])>8.65))continue;
    routeDistance=50*((1-t)*layout.distanceToCore[a]+t*layout.distanceToCore[b])+position.reduce((sum,n,i)=>sum+(i===axis?0:Math.abs(n-start[i])),0);break;
  }
  if(routeDistance===undefined){
    // The center crossing connects each portal. Using its axis distances keeps
    // the sound continuous at corners instead of cutting diagonally through rock.
    const offset=position.map((n,i)=>n-layout.coords[nearest][i]);
    let towardExit=0;
    for(const [a,b]of layout.links){
      const next=a===nearest?b:b===nearest?a:-1;
      if(next<0||layout.distanceToCore[next]>=layout.distanceToCore[nearest])continue;
      const axis=layout.coords[nearest].findIndex((n,i)=>n!==layout.coords[next][i]);
      towardExit=Math.max(towardExit,offset[axis]*Math.sign(layout.coords[next][axis]-layout.coords[nearest][axis]));
    }
    routeDistance=50*layout.distanceToCore[nearest]+offset.reduce((sum,n)=>sum+Math.abs(n),0)-2*towardExit;
  }
  return Math.max(.08,Math.min(1,1-routeDistance/340));
}
