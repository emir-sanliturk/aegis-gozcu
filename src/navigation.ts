export type NavigationId =
  | 'overview'
  | 'devices'
  | 'network'
  | 'incidents'
  | 'diagnostics'
  | 'commands'
  | 'shares'
  | 'promo'
  | 'settings';

export type NavigationItem = {
  id: NavigationId;
  label: string;
  shortLabel: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Durum Özeti',
    shortLabel: 'Özet',
    description: 'Sistemin güncel durumu',
  },
  {
    id: 'devices',
    label: 'Bağlı Cihazlar',
    shortLabel: 'Cihazlar',
    description: 'Eşleştirilmiş cihazlar',
  },
  {
    id: 'network',
    label: 'Cihaz Ağı',
    shortLabel: 'Ağ',
    description: 'Cihaz bağlantıları ve ilişkileri',
  },
  {
    id: 'incidents',
    label: 'Güvenlik Olayları',
    shortLabel: 'Olaylar',
    description: 'Gerçekleşen güvenlik olayları',
  },
  {
    id: 'diagnostics',
    label: 'Sistem Durumu',
    shortLabel: 'Tanılama',
    description: 'Bağlantı ve sistem kontrolleri',
  },
  {
    id: 'commands',
    label: 'Onaylı İşlemler',
    shortLabel: 'İşlemler',
    description: 'Kullanıcı onayı bekleyen işlemler',
  },
  {
    id: 'shares',
    label: 'Güvenli Paylaşımlar',
    shortLabel: 'Paylaşımlar',
    description: 'Süreli ve kontrollü erişimler',
  },
  {
    id: 'promo',
    label: 'Tanıtım Animasyonu',
    shortLabel: 'Tanıtım',
    description: '30 sn kurumsal teknik tanıtım',
  },
  {
    id: 'settings',
    label: 'Ayarlar',
    shortLabel: 'Ayarlar',
    description: 'Uygulama ve güvenlik ayarları',
  },
];
