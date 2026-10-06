import { Platform } from 'react-native';
export const colors = {navy:'#0B1F3A',primary:'#1E9FE8',bright:'#1E9FE8',accent:'#69C8F6',analytics:'#4977D1',background:'#F6FAFC',surface:'#FFFFFF',surfaceRaised:'#EFF8FD',input:'#FFFFFF',border:'#DCE5EC',text:'#152536',ink:'#152536',secondary:'#50677D',muted:'#667788',white:'#FFFFFF',sky:'#1E9FE8',pale:'#EFF8FD',success:'#198754',green:'#198754',amber:'#B7791F',info:'#2878B8',red:'#C0392B',softBlue:'#EFF8FD',softGreen:'#E9F7EF',softRed:'#FDEDEC'};
export const radius={md:10,lg:14,xl:20,pill:999} as const; export const spacing={sm:8,md:12,lg:16,xl:24,xxl:32} as const;
export const shadow=Platform.select({ios:{shadowColor:'#0B1F3A',shadowOpacity:0.08,shadowRadius:10,shadowOffset:{width:0,height:4}},android:{elevation:2},default:{}})||{};
export function humanize(value:string):string{return String(value||'').replace(/[_-]+/g,' ').replace(/\b\w/g,(letter)=>letter.toUpperCase())}
export function statusColor(status:string):string{const value=String(status||'').toLowerCase();if(/(closed|completed|paid|approved|cleared|received|posted|passed|success)/.test(value))return colors.success;if(/(cancel|reject|damage|overdue|failed|error)/.test(value))return colors.red;if(/(pending|waiting|hold|port|customs|transit|due|review)/.test(value))return colors.amber;return colors.info}
export const theme={colors,radius:radius.lg,space:spacing.lg} as const;
