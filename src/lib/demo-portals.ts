export const KYCHON_DEMO_PORTALS = [
  {
    key: 'eagles',
    deployKey: 'eagles',
    project: 'eagles',
    name: 'Eagles',
    organizationName: 'The Eagles -- Good Samaritans of Wichita',
    portalUrl: 'https://eagles.kychon.com',
    sdkCompatible: true,
  },
  {
    key: 'silver-pines',
    deployKey: 'silver-pines',
    project: 'silver-pines',
    name: 'Silver Pines',
    organizationName: 'Silver Pines Senior Center',
    portalUrl: 'https://silver-pines.kychon.com',
    sdkCompatible: true,
  },
  {
    key: 'barrio-unido',
    deployKey: 'barrio',
    project: 'barrio-unido',
    name: 'Barrio Unido',
    organizationName: 'Centro Comunitario Barrio Unido',
    portalUrl: 'https://barrio.kychon.com',
    sdkCompatible: true,
  },
] as const;

export type KychonDemoPortal = (typeof KYCHON_DEMO_PORTALS)[number];

export function findDemoPortalByProject(project: string): KychonDemoPortal | undefined {
  return KYCHON_DEMO_PORTALS.find((demo) => demo.project === project);
}

export function findDemoPortalByDeployKey(deployKey: string): KychonDemoPortal | undefined {
  return KYCHON_DEMO_PORTALS.find((demo) => demo.deployKey === deployKey);
}
