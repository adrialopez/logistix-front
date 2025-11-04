export const mostvisitChart = {
  series: [
    {
      name: 'PUDO',
      data: [44, 55, 41, 67, 22, 43],
    },
    {
      name: 'DOMICILIO',
      data: [13, 23, 20, 8, 13, 27],
    },
  ],
  chart: {
    type: 'bar' as const,
    fontFamily: "'Plus Jakarta Sans', sans-serif;",
    foreColor: '#adb0bb',
    toolbar: { show: false },
    height: 260,
    stacked: true,
  },
  plotOptions: {
    bar: {
      borderRadius: 10,
      horizontal: false,
      barHeight: '60%',
      columnWidth: '30%',
      borderRadiusApplication: 'end' as const,
      distributed: true,
    },
  },
  stroke: { show: false },
  dataLabels: { enabled: false },
  legend: { show: false },
  grid: { show: false },
  yaxis: { tickAmount: 4 },
  xaxis: {
    categories: ['01', '02', '03', '04', '05', '06'],
    axisTicks: { show: false },
  },
  tooltip: { theme: 'dark', fillSeriesColor: false },
};

export const pageimpChart = {
  series: [
    {
      name: '',
      data: [20, 15, 30, 25, 10],
    },
  ],
  chart: {
    type: 'bar' as const,
    fontFamily: "'Plus Jakarta Sans', sans-serif;",
    foreColor: '#adb0bb',
    toolbar: { show: false },
    height: 100,
    resize: true,
    barColor: '#fff',
    sparkline: { enabled: true },
  },
  colors: [
    '#E8F7FF',
    '#E8F7FF',
    '#49BEFF',
    '#E8F7FF',
    '#E8F7FF',
    '#E8F7FF',
  ],
  grid: { show: false },
  plotOptions: {
    bar: {
      borderRadius: 4,
      columnWidth: '50%',
      distributed: true,
      endingShape: 'rounded',
    },
  },
  dataLabels: { enabled: false },
  stroke: {
    show: true,
    width: 2.5,
    colors: ['rgba(0,0,0,0.01)'],
  },
  xaxis: {
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { show: false },
  },
  yaxis: { labels: { show: false } },
  axisBorder: { show: false },
  fill: { opacity: 1 },
  tooltip: { theme: 'dark', x: { show: false } },
};

export const mediaPedidoBarChart = {
  series: [
    {
      name: 'Media pedido',
      data: [] as number[],
    },
  ],
  chart: {
    type: 'bar' as const,
    height: 180,
    fontFamily: "'Plus Jakarta Sans', sans-serif;",
    foreColor: '#adb0bb',
    toolbar: { show: false },
    resize: true,
    barColor: '#fff',
  },
  colors: ['#5D87FF'],
  grid: { show: false },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: '60%',
      barHeight: '40%',
      borderRadius: 3,
    },
  },
  stroke: {
    show: true,
    width: 2.5,
    colors: ['rgba(0,0,0,0.01)'],
  },
  xaxis: {
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { show: true },
    categories: [] as string[],
  },
  yaxis: { labels: { show: true } },
  fill: { opacity: 1 },
  tooltip: { theme: 'dark', x: { show: false } },
  dataLabels: { enabled: false },
  legend: { show: false },
};

export const projectsChart = {
     series: [
    {
      name: 'Media pedido',
      data: [] as number[],
    },
  ],
  chart: {
    type: 'bar' as const,
    height: 180,
    fontFamily: "'Plus Jakarta Sans', sans-serif;",
    foreColor: '#adb0bb',
    toolbar: { show: false },
    resize: true,
    barColor: '#fff',
  },
  colors: ['#5D87FF'],
  grid: { show: false },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: '60%',
      barHeight: '40%',
      borderRadius: 3,
    },
  },
  stroke: {
    show: true,
    width: 2.5,
    colors: ['rgba(0,0,0,0.01)'],
  },
  xaxis: {
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { show: true },
    categories: [] as string[],
  },
  yaxis: { labels: { show: true } },
  fill: { opacity: 1 },
  tooltip: { theme: 'dark', x: { show: false } },
  dataLabels: { enabled: false },
  legend: { show: false },

};

export const kpiControlChart = {
  series: [0, 0, 0], // Entregados, En tránsito, Otros
  chart: {
    type: 'donut' as const,
    fontFamily: "'Plus Jakarta Sans', sans-serif;",
    foreColor: '#adb0bb',
    toolbar: { show: false },
    height: 260,
    stacked: true,
  },
  labels: ['Entregados', 'En tránsito', 'Otros'],
  colors: ['#5D87FF', '#49BEFF', '#e1e785ff'],
  legend: { 
    show: false,
    position: 'bottom' as const,
    horizontalAlign: 'center' as const,
    fontSize: '15px',
    itemMargin: {
      horizontal: 12,
      vertical: 10,
    }
  },
  dataLabels: { enabled: false },
  stroke: { show: false },
  grid: { show: false },
  plotOptions: {
    pie: {
      donut: {
        size: '80%',
        labels: { show: false },
      },
    },
  },
  tooltip: { theme: 'dark', fillSeriesColor: false },
};

export const pedidosUnidadesChart = {
  series: [
    {
      name: 'Pedidos',
      data: [0, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2800, 1700, 2200],
    },
    {
      name: 'Unidades',
      data: [0, 200, 300, 400, 500, 600, 700, 800, 1000, 1500, 900, 1200],
    },
  ],
  chart: {
    type: 'area' as const,
    height: 260,
    toolbar: { show: false },
    zoom: { enabled: false },
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth' as const, width: 2 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.4,
      opacityTo: 0.1,
      stops: [0, 90, 100],
    },
  },
  colors: ['#26c6da', '#1e88e5'],
  xaxis: {
    categories: [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
      'Ene',
      'Feb',
    ],
  },
  yaxis: {
    min: 0,
    max: 3000,
    tickAmount: 6,
  },
  legend: { show: true, position: 'top' as const, horizontalAlign: 'left' as const },
  tooltip: { theme: 'light' },
  grid: { borderColor: '#f1f1f1' },
};

export const distribucionTransportistaChart = {
  series: [35, 25, 15, 10, 15],
  chart: {
    type: 'donut' as const,
    height: 260,
    fontFamily: "'Plus Jakarta Sans', sans-serif;",
    toolbar: { show: false },
  },
  labels: ['Nacex', 'MRW', 'Correos', 'UPS', 'Paack'],
  colors: ['#3867fa', '#b2c7e6', '#4fc3f7', '#e3eafc', '#ffb74d'],
  legend: {
    show: true,
    position: 'bottom' as const,
    fontSize: '16px',
    fontWeight: 600,
    markers: {
      width: 12,
      height: 12,
      strokeWidth: 0, // Opcional: sin borde
    },
    itemMargin: { horizontal: 10, vertical: 0 },
    labels: { colors: '#222' },
  },
  dataLabels: { enabled: false },
  stroke: { show: false },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        background: 'transparent',
      },
    },
  },
  tooltip: { enabled: true, theme: 'light' },
};


