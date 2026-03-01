import type { Table, Cast, MenuItem, SetPlan, Customer, Room, ShiftEntry } from '../types'

export const initialRooms: Room[] = [
  { id: 'r1', name: 'Main Room' },
  { id: 'r2', name: 'VIPルーム' },
  { id: 'r3', name: 'カウンター' },
]

export const initialTables: Table[] = [
  { id: 't1', name: '1番', capacity: 4, status: 'empty', position: { x: 1, y: 1 }, roomId: 'r1' },
  { id: 't2', name: '2番', capacity: 4, status: 'empty', position: { x: 2, y: 1 }, roomId: 'r1' },
  { id: 't3', name: '3番', capacity: 6, status: 'empty', position: { x: 3, y: 1 }, roomId: 'r1' },
  { id: 't4', name: '4番', capacity: 4, status: 'empty', position: { x: 1, y: 2 }, roomId: 'r1' },
  { id: 't5', name: '5番', capacity: 4, status: 'empty', position: { x: 2, y: 2 }, roomId: 'r1' },
  { id: 't6', name: 'VIP1', capacity: 8, status: 'empty', position: { x: 3, y: 2 }, roomId: 'r2' },
  { id: 't7', name: 'VIP2', capacity: 6, status: 'empty', position: { x: 1, y: 3 }, roomId: 'r2' },
  { id: 't8', name: 'カウンター', capacity: 4, status: 'empty', position: { x: 2, y: 3 }, roomId: 'r3' },
]

export const initialCasts: Cast[] = [
  { id: 'c1', stageName: 'あいり', realName: '山田愛', isWorking: false, photo: 'https://i.pravatar.cc/150?img=47' },
  { id: 'c2', stageName: 'さくら', realName: '田中咲', isWorking: false, photo: 'https://i.pravatar.cc/150?img=45' },
  { id: 'c3', stageName: 'みく', realName: '鈴木美久', isWorking: false, photo: 'https://i.pravatar.cc/150?img=44' },
  { id: 'c4', stageName: 'れな', realName: '佐藤礼奈', isWorking: false, photo: 'https://i.pravatar.cc/150?img=49' },
  { id: 'c5', stageName: 'ゆい', realName: '伊藤唯', isWorking: false, photo: 'https://i.pravatar.cc/150?img=41' },
  { id: 'c6', stageName: 'なな', realName: '中村奈々', isWorking: false, photo: 'https://i.pravatar.cc/150?img=43' },
  { id: 'c7', stageName: 'まりな', realName: '渡辺真理奈', isWorking: false, photo: 'https://i.pravatar.cc/150?img=32' },
  { id: 'c8', stageName: 'りこ', realName: '高橋莉子', isWorking: false, photo: 'https://i.pravatar.cc/150?img=25' },
  { id: 'c9', stageName: 'ひなた', realName: '山本陽向', isWorking: false, photo: 'https://i.pravatar.cc/150?img=29' },
  { id: 'c10', stageName: 'えみ', realName: '中田笑美', isWorking: false, photo: 'https://i.pravatar.cc/150?img=36' },
]

export const initialMenuItems: MenuItem[] = [
  // ドリンク
  { id: 'm1', name: 'ウイスキー水割り', price: 1200, category: 'drink', isActive: true },
  { id: 'm2', name: 'ビール', price: 1000, category: 'drink', isActive: true },
  { id: 'm3', name: 'カクテル', price: 1200, category: 'drink', isActive: true },
  { id: 'm4', name: 'ソフトドリンク', price: 600, category: 'drink', isActive: true },
  { id: 'm5', name: 'シャンパン（グラス）', price: 3000, category: 'drink', isActive: true },
  // ボトル
  { id: 'm6', name: 'ウイスキーボトル', price: 15000, category: 'bottle', isActive: true },
  { id: 'm7', name: '芋焼酎ボトル', price: 12000, category: 'bottle', isActive: true },
  { id: 'm8', name: 'シャンパンボトル', price: 30000, category: 'bottle', isActive: true },
  // フード
  { id: 'm9', name: 'フルーツ盛り', price: 3000, category: 'food', isActive: true },
  { id: 'm10', name: 'おつまみセット', price: 2000, category: 'food', isActive: true },
  { id: 'm11', name: 'チーズ盛り', price: 2500, category: 'food', isActive: true },
  // レディースドリンク
  { id: 'm12', name: 'レディースドリンク', price: 1500, category: 'ladies_drink', isActive: true },
  // その他
  { id: 'm13', name: 'タバコ', price: 600, category: 'other', isActive: true },
]

export const initialSetPlans: SetPlan[] = [
  { id: 'sp1', name: 'Main Room（60分）', durationMinutes: 60, price: 10000, isActive: true },
  { id: 'sp2', name: 'T.O.C（30分）', durationMinutes: 30, price: 5000, isActive: true },
]

export const initialCustomers: Customer[] = [
  { id: 'cu1', name: '田中様', phone: '090-1234-5678', visitCount: 15, totalSpend: 250000, rank: 'vip', notes: 'ウイスキー好き', favoriteCastId: 'c1' },
  { id: 'cu2', name: '山田様', phone: '080-9876-5432', visitCount: 5, totalSpend: 75000, rank: 'repeat', favoriteCastId: 'c2' },
  { id: 'cu3', name: '佐藤様', visitCount: 1, totalSpend: 15000, rank: 'new' },
]

export const initialShifts: ShiftEntry[] = [
  // ── Week 1: Feb 16–22 ──
  // Mon 2/16 — 3人
  { castId: 'c1', date: '2026-02-16', startTime: '20:00', endTime: '01:00' },
  { castId: 'c3', date: '2026-02-16', startTime: '20:00', endTime: '01:00' },
  { castId: 'c5', date: '2026-02-16', startTime: '21:00', endTime: '02:00' },
  // Tue 2/17 — 3人
  { castId: 'c2', date: '2026-02-17', startTime: '20:00', endTime: '01:00' },
  { castId: 'c4', date: '2026-02-17', startTime: '20:00', endTime: '01:00' },
  { castId: 'c6', date: '2026-02-17', startTime: '21:00', endTime: '02:00' },
  // Wed 2/18 — 4人
  { castId: 'c1', date: '2026-02-18', startTime: '20:00', endTime: '01:00' },
  { castId: 'c2', date: '2026-02-18', startTime: '20:00', endTime: '01:00' },
  { castId: 'c5', date: '2026-02-18', startTime: '21:00', endTime: '02:00' },
  { castId: 'c7', date: '2026-02-18', startTime: '20:00', endTime: '00:00' },
  // Thu 2/19 — 4人
  { castId: 'c3', date: '2026-02-19', startTime: '20:00', endTime: '01:00' },
  { castId: 'c4', date: '2026-02-19', startTime: '21:00', endTime: '02:00' },
  { castId: 'c6', date: '2026-02-19', startTime: '20:00', endTime: '01:00' },
  { castId: 'c8', date: '2026-02-19', startTime: '20:00', endTime: '00:00' },
  // Fri 2/20 — 5人
  { castId: 'c1', date: '2026-02-20', startTime: '20:00', endTime: '02:00' },
  { castId: 'c2', date: '2026-02-20', startTime: '20:00', endTime: '01:00' },
  { castId: 'c3', date: '2026-02-20', startTime: '21:00', endTime: '02:00' },
  { castId: 'c5', date: '2026-02-20', startTime: '20:00', endTime: '01:00' },
  { castId: 'c9', date: '2026-02-20', startTime: '20:00', endTime: '01:00' },
  // Sat 2/21 — 7人
  { castId: 'c1', date: '2026-02-21', startTime: '20:00', endTime: '03:00' },
  { castId: 'c2', date: '2026-02-21', startTime: '20:00', endTime: '03:00' },
  { castId: 'c3', date: '2026-02-21', startTime: '20:00', endTime: '02:00' },
  { castId: 'c4', date: '2026-02-21', startTime: '21:00', endTime: '03:00' },
  { castId: 'c5', date: '2026-02-21', startTime: '20:00', endTime: '02:00' },
  { castId: 'c6', date: '2026-02-21', startTime: '20:00', endTime: '01:00' },
  { castId: 'c9', date: '2026-02-21', startTime: '21:00', endTime: '02:00' },
  // Sun 2/22 — 3人
  { castId: 'c7', date: '2026-02-22', startTime: '20:00', endTime: '01:00' },
  { castId: 'c8', date: '2026-02-22', startTime: '20:00', endTime: '00:00' },
  { castId: 'c10', date: '2026-02-22', startTime: '20:00', endTime: '01:00' },

  // ── Week 2: Feb 23–Mar 1 ──
  // Mon 2/23 — 3人
  { castId: 'c2', date: '2026-02-23', startTime: '20:00', endTime: '01:00' },
  { castId: 'c5', date: '2026-02-23', startTime: '21:00', endTime: '02:00' },
  { castId: 'c7', date: '2026-02-23', startTime: '20:00', endTime: '00:00' },
  // Tue 2/24 — 3人
  { castId: 'c1', date: '2026-02-24', startTime: '20:00', endTime: '01:00' },
  { castId: 'c3', date: '2026-02-24', startTime: '20:00', endTime: '01:00' },
  { castId: 'c8', date: '2026-02-24', startTime: '20:00', endTime: '00:00' },
  // Wed 2/25 — 5人
  { castId: 'c1', date: '2026-02-25', startTime: '20:00', endTime: '01:00' },
  { castId: 'c4', date: '2026-02-25', startTime: '20:00', endTime: '01:00' },
  { castId: 'c6', date: '2026-02-25', startTime: '21:00', endTime: '02:00' },
  { castId: 'c9', date: '2026-02-25', startTime: '20:00', endTime: '01:00' },
  { castId: 'c10', date: '2026-02-25', startTime: '20:00', endTime: '00:00' },
  // Thu 2/26 — 4人
  { castId: 'c2', date: '2026-02-26', startTime: '20:00', endTime: '01:00' },
  { castId: 'c3', date: '2026-02-26', startTime: '21:00', endTime: '02:00' },
  { castId: 'c5', date: '2026-02-26', startTime: '20:00', endTime: '01:00' },
  { castId: 'c10', date: '2026-02-26', startTime: '20:00', endTime: '01:00' },
  // Fri 2/27 — 6人
  { castId: 'c1', date: '2026-02-27', startTime: '20:00', endTime: '02:00' },
  { castId: 'c3', date: '2026-02-27', startTime: '20:00', endTime: '01:00' },
  { castId: 'c4', date: '2026-02-27', startTime: '21:00', endTime: '02:00' },
  { castId: 'c6', date: '2026-02-27', startTime: '20:00', endTime: '01:00' },
  { castId: 'c8', date: '2026-02-27', startTime: '20:00', endTime: '01:00' },
  { castId: 'c10', date: '2026-02-27', startTime: '21:00', endTime: '02:00' },
  // Sat 2/28 — 7人
  { castId: 'c1', date: '2026-02-28', startTime: '20:00', endTime: '03:00' },
  { castId: 'c2', date: '2026-02-28', startTime: '20:00', endTime: '03:00' },
  { castId: 'c3', date: '2026-02-28', startTime: '20:00', endTime: '02:00' },
  { castId: 'c5', date: '2026-02-28', startTime: '21:00', endTime: '03:00' },
  { castId: 'c6', date: '2026-02-28', startTime: '20:00', endTime: '01:00' },
  { castId: 'c7', date: '2026-02-28', startTime: '20:00', endTime: '02:00' },
  { castId: 'c9', date: '2026-02-28', startTime: '20:00', endTime: '02:00' },
  // Sun 3/1 — 2人
  { castId: 'c4', date: '2026-03-01', startTime: '20:00', endTime: '01:00' },
  { castId: 'c10', date: '2026-03-01', startTime: '20:00', endTime: '00:00' },

  // ── Week 3: Mar 2–8 ──
  // Mon 3/2 — 3人
  { castId: 'c1', date: '2026-03-02', startTime: '20:00', endTime: '01:00' },
  { castId: 'c4', date: '2026-03-02', startTime: '20:00', endTime: '01:00' },
  { castId: 'c8', date: '2026-03-02', startTime: '20:00', endTime: '00:00' },
  // Tue 3/3 — 3人
  { castId: 'c2', date: '2026-03-03', startTime: '20:00', endTime: '01:00' },
  { castId: 'c6', date: '2026-03-03', startTime: '21:00', endTime: '02:00' },
  { castId: 'c9', date: '2026-03-03', startTime: '20:00', endTime: '01:00' },
  // Wed 3/4 — 4人
  { castId: 'c1', date: '2026-03-04', startTime: '20:00', endTime: '01:00' },
  { castId: 'c3', date: '2026-03-04', startTime: '20:00', endTime: '01:00' },
  { castId: 'c5', date: '2026-03-04', startTime: '21:00', endTime: '02:00' },
  { castId: 'c7', date: '2026-03-04', startTime: '20:00', endTime: '00:00' },
  // Thu 3/5 — 4人
  { castId: 'c2', date: '2026-03-05', startTime: '20:00', endTime: '01:00' },
  { castId: 'c4', date: '2026-03-05', startTime: '21:00', endTime: '02:00' },
  { castId: 'c6', date: '2026-03-05', startTime: '20:00', endTime: '01:00' },
  { castId: 'c10', date: '2026-03-05', startTime: '20:00', endTime: '01:00' },
  // Fri 3/6 — 6人
  { castId: 'c1', date: '2026-03-06', startTime: '20:00', endTime: '02:00' },
  { castId: 'c2', date: '2026-03-06', startTime: '20:00', endTime: '01:00' },
  { castId: 'c5', date: '2026-03-06', startTime: '21:00', endTime: '02:00' },
  { castId: 'c7', date: '2026-03-06', startTime: '20:00', endTime: '01:00' },
  { castId: 'c8', date: '2026-03-06', startTime: '20:00', endTime: '01:00' },
  { castId: 'c9', date: '2026-03-06', startTime: '20:00', endTime: '02:00' },
  // Sat 3/7 — 8人
  { castId: 'c1', date: '2026-03-07', startTime: '20:00', endTime: '03:00' },
  { castId: 'c2', date: '2026-03-07', startTime: '20:00', endTime: '03:00' },
  { castId: 'c3', date: '2026-03-07', startTime: '20:00', endTime: '02:00' },
  { castId: 'c4', date: '2026-03-07', startTime: '21:00', endTime: '03:00' },
  { castId: 'c5', date: '2026-03-07', startTime: '20:00', endTime: '02:00' },
  { castId: 'c6', date: '2026-03-07', startTime: '20:00', endTime: '01:00' },
  { castId: 'c8', date: '2026-03-07', startTime: '21:00', endTime: '02:00' },
  { castId: 'c10', date: '2026-03-07', startTime: '20:00', endTime: '02:00' },
  // Sun 3/8 — 3人
  { castId: 'c5', date: '2026-03-08', startTime: '20:00', endTime: '01:00' },
  { castId: 'c9', date: '2026-03-08', startTime: '20:00', endTime: '01:00' },
  { castId: 'c10', date: '2026-03-08', startTime: '20:00', endTime: '00:00' },
]

export const STORE_PIN = '1234'
