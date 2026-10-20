import { usePreferences } from '../app/Preferences';

const assets = {
  overview: ['439f9.svg', '1f676.svg', 'ff15b.svg', '83d71.svg'],
  equipment: ['24466.svg', '1369a.svg', '01afb.svg', '3d6c6.svg'],
  requests: ['a974d.svg', '5497a.svg', '66bd5.svg', '29e67.svg'],
  rooms: ['fc579.svg', '0a5f6.svg', '89743.svg', '78820.svg'],
  administration: ['b77f0.svg', '15537.svg', 'c4e3a.svg', '29b57.svg'],
  profile: ['73f4b.svg', '7da2a.svg', 'fd7fe.svg', '30b00.svg'],
  sun: ['aecd3.svg', 'aecd3.svg', '3dadc.svg', '3dadc.svg'],
  moon: ['d194b.svg', 'd194b.svg', 'a3d8f.svg', 'a3d8f.svg'],
  menu: ['65aa2.svg', '65aa2.svg', 'af7c6.svg', 'af7c6.svg'],
  mobileUser: ['e5100.svg', 'e5100.svg', 'cd39e.svg', 'cd39e.svg'],
  equipmentPlaceholder: ['fffae.svg', 'fffae.svg', 'fffae.svg', 'fffae.svg'],
};

export type IconName = keyof typeof assets;

export function Icon({ name, active = false }: { name: IconName; active?: boolean }) {
  const { resolvedTheme } = usePreferences();
  const index = (resolvedTheme === 'dark' ? 2 : 0) + (active ? 1 : 0);
  const size =
    name === 'equipmentPlaceholder' ? 64 : name === 'menu' || name === 'mobileUser' ? 22 : 18;
  return (
    <img
      src={`/icons/${assets[name][index]}`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="icon"
    />
  );
}
