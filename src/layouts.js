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
  const coords = layout.cells.map(cell => cell.map(n => n * 50));
  const links = [
    ...Array.from({length:layout.coreRoom}, (_,i) => [i,i+1]),
    ...layout.branchLinks.map(pair => [...pair])
  ];
  return {
    name: layout.name,
    coords,
    links,
    coreRoom: layout.coreRoom,
    roomDepth: graphDistances(coords.length, links, 0),
    distanceToCore: graphDistances(coords.length, links, layout.coreRoom),
    cacheRooms: [...layout.cacheRooms],
    resupplyRooms: [...layout.resupplyRooms]
  };
}
