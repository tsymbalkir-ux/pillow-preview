#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Імпорт каталогу картонних ростових фігур з вигрузки Prom.

  python3 tools/import-rostovi.py export-products.xlsx links_brand.csv [-v]

Що робить:
  1. бере з вигрузки ростові фігури з картону (пластикові групи й «своє зображення» пропускає);
  2. прибирає 18+, дитячих персонажів і товари з логотипами брендів (ті самі правила, що й для дакімакур,
     tools/prom_tables.py, плюс список тайтлів CANON: значення None = не показувати);
  3. розкладає по розділах і колекціях (аніме: тайтл = спільне закінчення назв товарів);
  4. ширину бере з tools/rostovi-widths.json (його робить tools/rostovi-measure.py) і ставить ціну:
     ширина понад 82 см = 2000 грн, інакше 1590 грн;
  5. пише tools/rostovi-src.json. Сторінки з нього збирає tools/build-rostovi.py.
"""
import sys, os, re, json, csv, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import prom_tables as T
VERBOSE = '-v' in sys.argv; args = [a for a in sys.argv[1:] if a != '-v']
WIDE_CM, PRICE_WIDE, PRICE = 82, 2000, 1590

def read_export(path):
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True)['Export Products Sheet']
    rows = list(ws.iter_rows(values_only=True)); hdr = rows[0]
    return [{h: (r[i] if i < len(r) else None) for i, h in enumerate(hdr) if h and 'Характеристики' not in h} for r in rows[1:]]
R = read_export(args[0])
photos = collections.defaultdict(dict)
for r in csv.DictReader(open(args[1], encoding='utf-8-sig'), delimiter=';'):
    photos[r['id']][r['view'].replace('cardboard_', '')] = r['url'].strip()
photos = {k: v for k, v in photos.items() if {'front', 'back', 'combo'} <= set(v)}
W = json.load(open(os.path.join(HERE, 'rostovi-widths.json')))
W = {k: v for k, v in W.items() if 'bw' in v}

def strip(n):
    n = re.sub(r'(?i)ростова фігура|ростовая фигура|\b\d{2,4}\s*(см|мм|м)\b|картон|\(подушка обіймашка\)', ' ', n or '')
    n = n.replace('&#x27;', "'"); n = re.sub(r'\s*,\s*', ' ', n); n = re.sub(r'\s+№\s*', ' №', n)
    return re.sub(r'\s+', ' ', n).strip(' ,.')
def H(n):
    m = re.search(r'(\d{3,4})\s*мм', n or '')
    if m: return int(m.group(1)) // 10
    m = re.search(r'(\d{2,3})\s*см', n or ''); return int(m.group(1)) if m else 180

# ---- аніме: тайтл = найдовше спільне закінчення назв (є щонайменше у 2 товарів) ----
def split_titles(rows):
    names = {str(r['Унікальний_ідентифікатор']): strip(r['Назва_позиції_укр']) for r in rows}
    low = lambda s: s.lower().replace('ё', 'е')
    sup = collections.defaultdict(set)
    for n in names.values():
        w = n.split()
        for i in range(1, len(w)): sup[low(' '.join(w[i:]))].add(low(' '.join(w[:i])))
    out = {}
    for k, n in names.items():
        w = n.split(); cands = []
        for i in range(1, len(w)):
            sc = len(sup[low(' '.join(w[i:]))])
            if sc >= 2: cands.append((sc, len(w) - i, i))
        if cands:
            top = max(c[0] for c in cands)
            ok = [c for c in cands if c[0] >= 0.6 * top and c[1] >= 2] or [c for c in cands if c[0] >= 0.6 * top]
            _, _, i = max(ok, key=lambda c: (c[1], c[0])); out[k] = (' '.join(w[:i]), ' '.join(w[i:]))
        else: out[k] = (n, '')
    return out
SPLIT = split_titles([r for r in R if r['Назва_групи'] == 'Аниме Ростовые Фигуры'])

# ---- тайтли аніме: як написано в назві товару -> як показуємо на сайті (None = не показувати) ----
CANON = {
 'Blue Archive':'Blue Archive','High School DxD':'High School DxD','Магична битва':'Магічна битва','Сходження в тіні':'Сходження в тіні',
 'Коли я переродився слизом':'Про моє переродження в слиз','Цей прекрасний світ благословенний богом!':'KonoSuba',
 'Клинок що розсікає демонів':'Клинок, що розсікає демонів','Убивця демонів: Клинок що розтинає демонів':'Клинок, що розсікає демонів',
 'Blue Lock':'Blue Lock','Кухар небесного готелю':'Кухар небесного готелю','Лікар Стоун':'Dr. Stone','Wind Breaker':'Wind Breaker',
 'Хроніки фантастичних істот':'Хроніки фантастичних істот','Геншин Імпакт':'Genshin Impact','TOUGEN ANKI':'Tougen Anki',
 'Про моє переродження у сьомого принца':'Про моє переродження у сьомого принца','Неосяжна Блакить':'Неосяжна блакить',
 'Забагато кинутих героїнь':'Забагато кинутих героїнь','Доля/Великий наказ':'Fate/Grand Order','Доля/Ніч сутички':'Fate/stay night',
 'Вічний сутінок':'Вічний сутінок','Атака Титанів':'Атака титанів','Атака титанів':'Атака титанів','Дандадан':'Дандадан',
 'Підібраний авантюристом рангу S':'Підібраний авантюристом рангу S','Scooped Up by an S-Rank Adventurer!':'Підібраний авантюристом рангу S',
 'Темний демон':'Темний демон','Маленька відьма: Таємниця мовчазної чаклунки':'Таємниця мовчазної чаклунки','Детектив Конан':'Детектив Конан',
 'Монолог Травниці':'Монолог фармацевта','Поклик ночі':'Поклик ночі','Azur Lane':'Azur Lane','Людина-бензопила':'Людина-бензопила',
 'Господар майстерні через непорозуміння':'Господар майстерні через непорозуміння','Туалетний хлопчик':'Туалетний хлопчик Ханако',
 'Потворний епічний боєць':'Потворний епічний боєць',"Сім'я шпигуна":"Сім'я шпигуна (Spy x Family)",
 'Ця фарфорова лялечка закохалася':'Ця порцелянова лялечка закохалася','Ця порцелянова лялька закохалася':'Ця порцелянова лялечка закохалася',
 'Колишній наречений сестри закохується в знедолену леді':'Колишній наречений сестри','Недбала молода дівчина доглядає колишній наречений її сестри':'Колишній наречений сестри',
 'дівчат які дуже тебе кохають':'100 дівчат, які дуже тебе кохають','Маг води':'Маг води','Дні Сакомото':'Дні Сакамото','Механічна Марі':'Механічна Марі',
 'Сільський дядько стає майстром меча':'Сільський дядько стає майстром меча','Нове життя блискучого цілителя в тіні':'Нове життя блискучого цілителя в тіні',
 'Життя з отаку куноічі-дармоїдкою':'Життя з отаку куноічі-дармоїдкою','Підняття рівня поодинці':'Підняття рівня поодинці (Solo Leveling)',
 'Наруто: Ураганні хроніки':'Наруто','Реінкарнація безробітного':'Реінкарнація безробітного','Гачакута':'Гачакута','Рок — це заняття для леді':'Рок — це заняття для леді',
 'Нескінченна Гача':'Нескінченна гача','Чи можу я дещо попросити?':'Чи можу я дещо попросити?','Вершник апокаліпсису Міноґра':'Апокаліпсис Міноґри',
 'Апокаліпсис Міногри':'Апокаліпсис Міноґри','Вітаємо у ресторані вигнанця':'Вітаємо у ресторані вигнанця','Літо коли помер Хікару':'Літо, коли помер Хікару',
 'Три сестри Мікадоко виявилися несподівано простими':'Три сестри Мікадоко','Герой без класу':'Герой без класу',
 'Вигнаний Придворний Чарівник прагне стати Сильнішим':'Вигнаний придворний чарівник','Тітосе всередині бутилки Рамуне':'Тітосе в пляшці рамуне',
 'Ароматна квітка цвіте з гідністю':'Ароматна квітка цвіте з гідністю','Чи існує дружба між хлопцем та дівчиною?':'Чи існує дружба між хлопцем та дівчиною?',
 'Початок після кінця':'Початок після кінця','Зламаний світ і Міку що не співає':'Project Sekai','Я монстр рангу S Бегемот':'Я монстр рангу S: Бегемот',
 'Ватарі вже на межі':'Ватарі вже на межі','Дівчата і танки':'Дівчата і танки','Побачення з життям':'Date A Live','Аркнайтс':'Arknights',
 'Клеватесс: Король демонічних звірів немовля та герой нежиті':'Клеватесс','Сходження героя щита':'Сходження героя щита',
 'Молодша сестра мого друга докучає':'Молодша сестра мого друга докучає','Подайте мясо монстра міледі!':'Подайте мʼясо монстра, міледі!',
 'Крик дівочого гурту':'Крик дівочого гурту','Нізащо у світі я не стану твоєю коханою!':'Нізащо у світі я не стану твоєю коханою!','Ruri Rocks':'Ruri Rocks',
 'Чорна куля':'Чорна куля','Дракон Раджа':'Дракон Раджа','Мій статус вбивці вочевидь перевершує геройський':'Мій статус убивці перевершує геройський',
 'Незграбна семпай':'Незграбна семпай','With You Our Love Will Make It Through':'With You, Our Love Will Make It Through','Самітниця-рокер!':'Самітниця-рокер!',
 'Літературний клуб Доки-Доки!':'Doki Doki Literature Club','клуб Доки-Доки!':'Doki Doki Literature Club','Академія Колапсу':'Honkai Impact 3rd','Колапс 3':'Honkai Impact 3rd',
 'Клас еліти':'Клас еліти','записи поганого вчителя магії':'Записи поганого вчителя магії','Король таємниць':'Король таємниць',
 'Монстр хоче зїсти мене':'Монстр хоче з’їсти мене','Frieren':'Фрірен','Вогняний герб':'Fire Emblem','Диявольські коханці':'Диявольські коханці',
 'Перлина дракона':'Перлина дракона (Dragon Ball)','Бродячі пси літератури':'Великий із бродячих псів','Клітини за роботою!':'Клітини за роботою!',
 "З'явився дикий останній бос!":"З'явився дикий останній бос!",'Подорож збирача в іншому світі':'Подорож збирача в іншому світі','Манчкін в іншому світі':'Манчкін в іншому світі',
 'Кулінарні поневіряння в паралельному світі':'Кулінарні поневіряння в паралельному світі','Аріфурета: від звичайного до найсильнішого у світі':'Аріфурета',
 'Змішування':'Змішування','Макіно':'Макіно','Лінія фронту':"Girls' Frontline",'Зошит смерті':'Зошит смерті','Данганронпа: Щасливий хаос':'Danganronpa',
 'Вогняна бригада':'Вогняна бригада','Полум\'яні Вогнеборці':'Вогняна бригада','Шарлотта':'Шарлотта',
 # 18+ і діти: прибираємо
 'Нукіташі':None,'Вуста заміжньої жінки на смак як алкоголь':None,'Губи заміжньої жінки мають смак консервованого чухаю':None,
 "Трусья Чулко і пресвятий Підв'яз":None,'Первородний гріх Такопі':None,'Дораемон: Історія картинного світу Нобіти':None,
 "Shiunji Діти сім'ї Шіунджі":None,"Діти сім'ї Шіунджі":None,'Чому ви тут учителько?!':None,'Не трогай меня Котэсаси':None,'Вдягни їх Такаміне':None,
 'Спостерігаючи колготи':None,'Раб спеціального призначення':None,'Сакура — збирачка карт':None,
}
SPORT_IN_ANIME = {'UFC':'UFC і бокс','Баскетбол':'Баскетбол','Теніс':'Теніс','Футбол':'Футбол'}
keys = sorted(CANON, key=len, reverse=True)
lowk = lambda s: re.sub(r'[^0-9a-zа-яіїєґё]', '', s.lower().replace('’', "'"))
exname = re.compile(T.EXCLUDE_NAME, re.I)
EXTRA_BAD = re.compile(r"(?i)\bдіти\b|розсунутих|чохол для подушки|подушка обіймашка|\bпиво\b|енергетичн")

items, drop = [], collections.Counter()
seen_name = collections.Counter()
for r in R:
    uid = str(r['Унікальний_ідентифікатор'])
    if uid not in W or uid not in photos: continue   # пластик і фігури без виміряних фото
    g = r['Назва_групи']; full = r['Назва_позиції_укр'] or ''; nm = strip(full)
    if g == 'Ростовые фигуры со своим изображением': drop['своє зображення'] += 1; continue
    if (exname.search(full + ' ' + (r['Назва_позиції'] or '')) and not re.search(r'Асагірі|Jishibari', full)) or EXTRA_BAD.search(full): drop['18+/діти/бренди'] += 1; (print('  прибрано:', full[:80]) if VERBOSE else None); continue
    char, col, sec = nm, None, None
    if g == 'Аниме Ростовые Фигуры':
        c0, t0 = SPLIT.get(uid, (nm, ''))
        if t0 in SPORT_IN_ANIME: sec, col, char = 'sport', SPORT_IN_ANIME[t0], c0
        else:
            low = lowk(nm); hit = None
            for k in keys:
                lk = lowk(k)
                if low.endswith(lk) and len(low) > len(lk): hit = k; break
            if hit:
                if CANON[hit] is None: drop['18+/діти (тайтл)'] += 1; continue
                col = CANON[hit]
                # відрізаємо назву тайтлу від імені персонажа
                ws = nm.split()
                for i in range(len(ws), 0, -1):
                    if lowk(' '.join(ws[i-1:])) == lowk(hit): char = ' '.join(ws[:i-1]); break
                else: char = c0 or nm
            elif t0 and t0 in CANON and CANON[t0] is None: drop['18+/діти (тайтл)'] += 1; continue
            else: col = 'Інше аніме'
            sec = sec or 'anime'
    elif g == 'Актеры': sec, col = 'stars', 'Актори'
    elif g == 'Певцы и музыканты': sec, col = 'music', 'Музиканти'
    elif g == 'К-ПОП':
        sec = 'kpop'; m = re.match(r'(.*?\))\s*(.+)$', nm)
        if m: char, col = m.group(1), m.group(2).strip()
        else: col = 'K-pop'
        col = re.sub(r'\s*\d.*$','',col); col = {'Stray Kid':'Stray Kids','Got7':'GOT7','TWICE':'TWICE','Exo':'EXO','Aespa':'aespa','Got7':'GOT7','Seventeen':'SEVENTEEN','Enhypen':'ENHYPEN'}.get(col, col)
    elif g == 'Формула 1': sec, col, char = 'sport', 'Формула 1', re.sub(r'\s*Формула 1$', '', nm)
    elif g == 'Футбол': sec, col, char = 'sport', 'Футбол', re.sub(r'\s*Футбол$', '', nm)
    elif g == 'Ростовые Фигуры 2':
        sec, col = 'movies', 'Кіно, серіали й мультфільми'
        if re.search(r'(?i)UFC|МакГрегор|Хабіб|Усик|Тайсон|Мохаммед Алі', nm): sec, col = 'sport', 'UFC і бокс'
    else: drop['інша група: ' + str(g)] += 1; continue
    if not char.strip(' ,.-'): char = nm
    if not char.strip(' ,.-'): char = col
    h = H(full); m = W[uid]; w = h * m['bw'] / (m['mb'] - m['mt'])
    items.append(dict(id=uid, n=char.strip(' ,.-'), c=col, s=sec, h=h, w=round(w), p=PRICE_WIDE if w > WIDE_CM else PRICE,
                      ph=[photos[uid].get('front'), photos[uid].get('back'), photos[uid].get('combo')]))
# дрібні колекції аніме (менше 3 фігур) складаємо в «Інше аніме», назву тайтлу дописуємо до імені
n_col = collections.Counter(i['c'] for i in items if i['s'] == 'anime')
for i in items:
    if i['s'] == 'anime' and i['c'] != 'Інше аніме' and n_col[i['c']] < 3:
        i['n'] = f"{i['n']} ({i['c']})"; i['c'] = 'Інше аніме'
for i in items: i['n'] = re.sub(r'\s+', ' ', i['n']).strip()
# однакові імена в одній колекції нумеруємо
cnt = collections.Counter((i['c'], i['n'].lower()) for i in items); k2 = collections.Counter()
for i in items:
    key = (i['c'], i['n'].lower())
    if cnt[key] > 1 and '№' not in i['n']: k2[key] += 1; i['n'] += f' №{k2[key]}'
import datetime
json.dump({'v': datetime.date.today().isoformat(), 'items': items}, open(os.path.join(HERE, 'rostovi-src.json'), 'w'), ensure_ascii=False, indent=0)
print('Фігур:', len(items), dict(drop))
print('За ціною:', dict(collections.Counter(i['p'] for i in items)))
