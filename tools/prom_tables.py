# -*- coding: utf-8 -*-
"""Довідники для імпорту каталогу дакімакур з вигрузки Prom (tools/import-prom.py).
Ключ усюди: українська назва групи Prom (останній рівень)."""

# ---- що не потрапляє на сайт -------------------------------------------------
# групи 18+ та тайтли, де головні герої діти
EXCLUDE_GROUPS = {
    'Селебріті 18+', 'Хтивий татусь', 'Чорний звір: Осквернення благородних жриць', 'Нукіташі', 'Bishoujo Mangekyou',
    'Калейдоскоп красунь', 'Губи заміжньої жінки на смак як тюхай', 'Meru the Succubus', 'Monster Girl Encyclopedia',
    'Valkyrie Drive', 'Самотність на двох', 'Навіщо ви тут, вчителько?!', 'Не чіпай, Котесаші!', 'Споглядаючи колготки',
    'Заповіт сестри нового диявола', 'За велінням пекельної сестри', 'Тюремна школа (Prison School)', 'Senran Kagura',
    'Нудний світ,де не існує самої ідеї похабних жартів', 'Scum\'s Wish (Бажання покидьків)', 'Шкільні дні',
    'Аліса, або Аліса: Брат-сисконщик і сестри-близнючки', 'Чи ти готовий закохатися в збоченку до тих пір, поки вона мила?',
    'Принц-пошляк і кішка-несміяна', 'Бікіні-воїни', 'Клинок королеви', 'Кэйджо', 'Раб спецзагону демонічного міста',
    'Дакімакура зі своїм прінтом',
    # діти в головних ролях
    'Эроманга-сенсей', 'Ангельське тріо', 'Первородний гріх Такопі', 'Створений в Безодні', 'Сакура — збирачка карт',
    'Non Non Biyori', 'Замовляли кролика?', 'YuruYuri', 'Заради своєї дочки я зможу перемогти навіть короля демонів',
    'Ну не може моя сестра бути такою милою', 'Було б краще, якби тут була тільки молодша сестра', 'Маленькі бешкетники!',
    'Дораемон', 'Пекельна дівчинка', 'Urara Meirochou', 'Місто провісниць', 'Ти ж любиш неньку, ударів якої б\'ють по площі подвійним втратою?',
}
# слова в назві товару (укр або рос), з якими він не потрапляє на сайт
EXCLUDE_NAME = (r'bdsm|shibari|хента[йі]|hentai|18\s*\+|порно|porn\b|futa|\bnude\b|naked|розсунутих ніг|раздвинутых ног|секс-|'
                r'sexx|succub|сукуб|\bлолі\b|\bлоли\b|\bloli\b|'
                # персонажі-діти
                r'\bклі\b|\bklee\b|ці\s*ц[иі]\b|\bqiqi\b|\bдіона\b|\bdiona\b|\bсаю\b|\bsayu\b|нах[іи]да|nahida|яо\s*яо|yaoyao|\bдор[іи]\b|паймон|paimon|'
                r'канна каму[їи]|kanna kamui|\bлат[іи]на\b|сагір[іи]|sagiri|юн[іи]корн|unicorn|обіцяний неверленд|neverland|'
                r'\bгук\b|\bhook\b|байлу|bailu|такоп[іи]')

# ---- групи Prom, що відповідають наявним колекціям сайту ----------------------
GROUP_TO_COL = {
    'Genshin Impact (Геншин Імпакт)': 'genshin', 'Dota 2': 'dota', 'Анімаційний проект «Vocaloid China»': 'vocaloid',
    'Honkai: Star Rail': 'hsr', 'Клинок, розсікає демонів': 'ds', 'Zenless Zone Zero': 'zzz', 'Магічна битва': 'jjk',
    'BRAWL STARS': 'brawl', "П'ять наречених": 'quints', 'Моя геройська академія': 'mha', 'Атака Титанів': 'aot',
    'Людина-бензопила': 'chainsaw', 'Повелитель': 'overlord', 'Наруто': 'naruto', 'Дівчата-поні: Славне дербі': 'uma',
    'Бліч': 'bleach', 'Дівчата і танки': 'gup', 'Євангеліон нового покоління': 'eva', 'Монолог фармацевта': 'apothecary',
    'Музиканти': 'music', 'Рок та метал': 'music', 'Ван-Піс': 'onepiece', 'Мій маленький поні: Дружба — це диво': 'mlp',
    'Формула 1': 'f1', 'Великий із бродячих псів': 'bsd', 'Реінкарнація безробітного': 'mushoku', 'Cyberpunk 2077': 'cyberpunk',
    'Гаррі Поттер': 'hp', 'Меми': 'memes', 'Клуб романтики': 'romclub', 'Українські зірки': 'ukr', 'Wuthering Waves': 'wuwa',
    'Літературний клуб': 'ddlc', 'Берсерк': 'berserk', 'Шрек': 'shrek', 'Сутінки (Twilight)': 'twilight', 'Щоденники вампіра': 'tvd',
    'Селебріті': 'celebs', 'Алкогольні напої': 'alcohol', 'Безалкогольні напої': 'softdrinks', 'Футбол': 'football',
    'BTS': 'bts', 'Stray kids': 'straykids', 'BanChan': 'straykids',
}

# ---- нові тайтли: гарна назва і розділ ---------------------------------------
# розділи: anime, games, kpop, stars, movies, sport, drinks, other
RENAME = {
    'Лазурний шлях': 'Azur Lane', 'Доля': 'Fate', 'Колапс 3': 'Honkai Impact 3rd', 'Синій Архів': 'Blue Archive',
    'Флотська колекція': 'Kantai Collection', 'Рандеву з життям': 'Date A Live', 'Аркнайтс': 'Arknights',
    'Віртуальний перегляд': 'VTuber та Hololive', 'Тохо': 'Touhou Project', 'Вища школа DxD': 'High School DxD',
    'Жива любов!': 'Love Live!', 'Дівчата з обмеженими можливостями': "Girls' Frontline", 'Цей чудовий світ!': 'KonoSuba',
    'Re:Zero. Життя в альтернативному світі з нуля': 'Re:Zero', 'Про моєму переродження в слиз': 'Про моє переродження в слиз',
    'Майстер меча Онлайн': 'Sword Art Online', 'Як і очікував, моя шкільна романтична життя не вдалася': 'OreGairu',
    'Танець мечів': 'Touken Ranbu', "Синя в'язниця: Блю Лок": 'Blue Lock', 'Червоний, Білий, Чорний, Жовтий': 'RWBY',
    'Пані Кагуя: В любові, як на війні': 'Каґуя: у коханні як на війні', 'Скейт: Нескінченність': 'SK8 the Infinity',
    'Улюблений під Франксе': 'Darling in the Franxx', 'Ця порцелянова лялечка закохалася': 'My Dress-Up Darling',
    'Волейбол!!': 'Волейбол!! (Haikyu)', 'Идолмастер': 'The Idolmaster', 'Як виховати героїню зі звичайної дівчини': 'Saekano',
    "Сім'я шпигуна": "Сім'я шпигуна (Spy x Family)", 'Якийсь науковий Рейлган': 'Якийсь науковий Рейлган',
    'Доктор Стоун': 'Dr. Stone', 'Ласкаво просимо в клас переваги': 'Клас еліти', 'Данганронпа': 'Danganronpa',
    'Прокляття: Автоматизація': 'NieR: Automata', 'Осомацу': 'Осомацу-сан', 'Повсякденне життя з дівчиною-монстром:': 'Monster Musume',
    'У підземеллі я піду... / Може, я зустріну тебе в підземеллі?': 'DanMachi', 'Ліга Легенд': 'League of Legends',
    'Вайолет Эвергарден': 'Вайолет Евергарден', 'Гріх: Сім смертних гріхів': 'Сім смертних гріхів',
    'Блакитна мрія Грана(Фантазія ГранБлю)': 'Granblue Fantasy', 'Таємничий Мессенджер': 'Mystic Messenger',
    'Ванпачмен': 'Ванпанчмен', 'Ворота Штейну': 'Steins;Gate', 'Любовні неприємності': 'To Love-Ru',
    'Труська, Чулко і пресвятої Подвяз': 'Panty & Stocking', 'Я-Сакамото, а що?': 'Я Сакамото, а що?', 'Шалений азарт': 'Шалений азарт (Kakegurui)',
    'Табір на свіжому повітрі': 'Yuru Camp', 'Хэллтэйкер': 'Helltaker', 'Цей дурний свин не розуміє мрію дівчинки-зайки': 'Дівчинка-зайка (Bunny Girl Senpai)',
    'Арія - Червона Куля': 'Арія Червона Куля', 'Легенда про Зельде': 'The Legend of Zelda', 'Пісня бойових принцес: Мехасимфония': 'Symphogear',
    'Лукава сестро Умару!': 'Умару-чан', 'Арифурэта: Найсильніший ремісник у світі': 'Arifureta', 'Хвіст Феї': 'Fairy Tail',
    'Історії: цикл': 'Monogatari', 'Котячий рай': 'Nekopara', 'NEKOPARA': 'Nekopara', 'Подорож Элейны': 'Подорож Елейни',
    'Код Гіас: Повсталий Лелуш': 'Code Geass', 'Темний демон (Kuro no Shoukanshi)': 'Tougen Anki', 'BRAWL STARS': 'Brawl Stars',
    'Onmyoji (Онмьодзі)': 'Onmyoji', 'Мультфільми та Disney': 'Мультфільми та Disney', 'Баскетбол / NBA': 'Баскетбол і NBA',
    'UFC / MMA': 'UFC і MMA', 'Друзі (Friends)': 'Друзі', 'Знак вогню': 'Fire Emblem', 'Покемони': 'Покемони',
    'Токійський гуль': 'Токійський гуль', 'Дандадан': 'Дандадан', 'Авто': 'Авто', 'Persona / Shin Megami Tensei': 'Persona',
    'Resident Evil (Оселя зла)': 'Resident Evil', 'The Witcher (Відьмак)': 'Відьмак', 'Оші но Ко (Дитя айдола)': 'Оші но Ко',
    'Tsukihime / Neco-Arc': 'Tsukihime', 'Helluva Boss / Hazbin Hotel': 'Готель Хазбін і Helluva Boss', 'Венсдей (Wednesday)': 'Венсдей',
    'Вуличний боєць': 'Street Fighter', 'Супер Маріо': 'Super Mario', 'Зірки ансамблю': 'Ensemble Stars', 'Соло-левелінг': 'Solo Leveling',
    'Фрірен, що проводжає в останню путь': 'Фрірен', 'Сходження Героя Щита': 'Сходження героя щита', 'Сейлор Мун': 'Сейлор Мун',
    'Неймовірна пригода ДжоДжо': 'ДжоДжо', 'Мисливець х Мисливець': 'Hunter x Hunter', 'Зошит смерті': 'Зошит смерті',
    'Драконівські перли': 'Dragon Ball', 'Югио! Дуэльные монстри': 'Yu-Gi-Oh!', 'Югио!': 'Yu-Gi-Oh!', 'Діви Розена': 'Rozen Maiden',
    'Лазурний Гримуар: Інші Спогади': 'BlazBlue', 'Драгон Квест': 'Dragon Quest', 'Аватар (фільм)': 'Аватар', 'Форсаж (Fast & Furious)': 'Форсаж',
    'Дивні дива (Stranger Things)': 'Дивні дива', 'Вежа Бога (Tower of God)': 'Вежа Бога', 'Хорори (Horror)': 'Хорори',
}
GAMES = {
    'Azur Lane', 'Honkai Impact 3rd', 'Blue Archive', 'Kantai Collection', 'Arknights', 'Touhou Project', "Girls' Frontline",
    'Mortal Kombat', 'Princess Connect! Re:Dive', 'Overwatch', 'Touken Ranbu', 'NIKKE: Goddess of Victory', 'Onmyoji', 'The Idolmaster',
    'Warcraft', 'Danganronpa', 'League of Legends', 'Granblue Fantasy', 'Mystic Messenger', 'MiSide', 'Counter-Strike 2', 'Андертейл',
    'Helltaker', 'Warhammer', 'The Legend of Zelda', 'Легенда про героїв', 'Devil May Cry', 'Persona', 'Final Fantasy', 'Xenoblade Chronicles',
    'Elsword', 'Fire Emblem', 'Atelier Ryza', 'Resident Evil', 'Street Fighter', 'Super Mario', 'Ensemble Stars', 'Dragon Raja', 'Відьмак',
    'Hyperdimension Neptunia', 'Obey Me!', 'Voices Of the Void', 'BlazBlue', 'Dragon Quest', 'Любов і продюсер', 'Nekopara', 'NieR: Automata',
    'Вічна воля', 'Gal Gohan / Гальгейм', 'Супер Сонико', 'Union Quartet', 'Tsukihime',
}
MOVIES = {
    'Marvel', 'DC Comics', 'Star Wars', 'Теорія великого вибуху', 'Друзі', 'Мультфільми та Disney', 'Готель Хазбін і Helluva Boss',
    'Венсдей', 'Аватар', 'Форсаж', 'Дивні дива', 'Турецькі серіали', 'Молодий Папа', 'Хорори', 'Зверополис', 'Юні Титани',
    'Фостер: Будинок для друзів зі світу фантазій', 'Соник Ікс',
}
SPORT = {'Баскетбол і NBA', 'UFC і MMA'}
OTHER = {'Авто'}

# ---- K-pop: гурти -------------------------------------------------------------
BANDS = ['BLACKPINK', 'Red Velvet', 'ENHYPEN', 'TOMORROW X TOGETHER', 'Aespa', 'NCT', 'SEVENTEEN', 'Twice', 'Exo', 'ITZY', 'ATEEZ',
         '(G)I-DLE', 'Monsta X', 'Oh My Girl', 'GFriend', 'BigBang', 'SHINee', 'IZ*ONE', 'Mamamoo', 'ASTRO', 'Super Junior', 'IU',
         'GOT7', 'LE SSERAFIM', 'NewJeans', 'IVE', 'TXT', 'Babymetal']
BAND_ALIAS = {'TXT': 'TOMORROW X TOGETHER', 'NCT 127': 'NCT'}
PERSON_BAND = {'дженні кім': 'BLACKPINK', 'пак чхе йон': 'BLACKPINK', 'лаліса': 'BLACKPINK', 'джису': 'BLACKPINK',
               'сонхун': 'ENHYPEN', 'хісин': 'ENHYPEN', 'джейк': 'ENHYPEN', 'ні-кі': 'ENHYPEN', 'джей': 'ENHYPEN', 'сону': 'ENHYPEN', 'чонвон': 'ENHYPEN',
               'сакура': 'LE SSERAFIM', 'чевон': 'LE SSERAFIM', 'юнджін': 'LE SSERAFIM', 'казуха': 'LE SSERAFIM'}

# ---- як ще тайтл пишуть у назвах товарів (щоб лишити в назві тільки персонажа) --
ALIASES = {
    'Genshin Impact (Геншин Імпакт)': ['Genshin Impact (Генші Імпакт)', 'Genshin Impact', 'Геншин Імпакт', 'Геншін Імпакт', 'Генші Імпакт', 'Геншин', 'Геншін'],
    'Лазурний шлях': ['Лазурний шлях Azur Lane', 'Azur Lane', 'Лазурний шлях', 'Азур Лейн'],
    'Темний демон (Kuro no Shoukanshi)': ['TOUGEN ANKI', 'Tougen Anki', 'Темний демон'],
    'Доля': ['/Великий наказ: Вавилонія', ': Великий наказ', '/Великий наказ', '/Ніч сутички', '/Апокриф', 'Великий наказ', 'Ніч сутички', 'Судіба', 'Судьби', 'долі', 'Доля/Ніч сутички', 'Доля/Великий наказ', 'Доля/Апокриф', 'Доля/Початок', 'Fate Grand Order', 'Fate/Grand Order', 'Fate', 'Доля', 'Судьба', 'Доньба', 'Додьба', 'FGO'],
    'Колапс 3': ['Honkai Impact 3rd', 'Honkai Impact', 'Хонкай Імпакт', 'Академія Колапсу', 'Колапс 3', 'Колапс 4'],
    'Синій Архів': ['Blue Archive', 'Синій Архів', 'Блю Архів'], 'Аркнайтс': ['Arknights', 'Аркнайтс', 'Aркнайтс'],
    'Флотська колекція': ['Kantai Collection', 'Флотська колекція', 'KanColle'], 'Тохо': ['Touhou Project', 'Touhou', 'Тохо'],
    'Віртуальний перегляд': ['Віртуальний ютубер', 'Віртуальний перегляд', 'Hololive', 'Vtuber', 'VTuber'],
    'Dota 2': ['(Dota 2)', 'Dota 2', 'Дота2', 'Дота 2'], 'Honkai: Star Rail': ['Honkai: Star Rail', 'Honkai Star Rail', 'Хонкай Стар Рейл', 'Star Rail'],
    'Zenless Zone Zero': ['Zenless Zone Zero', 'ZZZ'], 'Рандеву з життям': ['Date A Live', 'Рандеву з життям', 'Побачення з життям'],
    'Жива любов!': ['Love Live!', 'Love Live', 'Жива любов!', 'Живе кохання!'], 'Дівчата з обмеженими можливостями': ["Girls' Frontline", 'Дівчата на лінії фронту', 'Girls Frontline'],
    'Вища школа DxD': ['High School DxD', 'Старша школа DxD', 'Вища школа DxD', 'DxD'], 'NIKKE: Goddess of Victory': ['NIKKE: Goddess of Victory', 'Goddess of Victory', 'NIKKE', 'Nikke'],
    'Princess Connect! Re:Dive': ['Princess Connect! Re:Dive', 'Princess Connect'], 'Mortal Kombat': ['Mortal Kombat', 'Мортал Комбат'],
    'Overwatch': ['Overwatch', 'Овервотч'], 'Marvel': ['(Месники)', 'Marvel'], 'DC Comics': ['DC Comics', 'DC'], 'Star Wars': ['Star Wars', 'Зоряні війни'],
    'Синя в\'язниця: Блю Лок': ['Blue Lock', 'Блю Лок', "Синя в'язниця"], 'Warcraft': ['World of Warcraft', 'Warcraft', 'Варкрафт'],
    'Ліга Легенд': ['League of Legends', 'Ліга Легенд'], 'Counter-Strike 2': ['Counter-Strike 2', '(CS2)', 'CS2'], 'Cyberpunk 2077': ['Cyberpunk 2077', 'Cyberpunk', 'Кіберпанк'],
    'Wuthering Waves': ['Wuthering Waves'], 'MiSide': ['MiSide'], 'Warhammer': ['Warhammer 40K', 'Warhammer', '40K'], 'Devil May Cry': ['Devil May Cry'],
    'BRAWL STARS': ['Brawl Stars', 'Бравл Старс'], 'Клуб романтики': ['Клуб романтики', 'Клуб Романтики'], 'Меми': ['Меми'],
    'Мій маленький поні: Дружба — це диво': ['My Little Pony', 'Мій маленький поні'], 'Гаррі Поттер': ['Гаррі Поттер'],
    'Формула 1': ['Формула 1', 'Formula 1', 'F1'], 'Теорія великого вибуху': ['(Теорія великого вибуху)', 'Теорія великого вибуху', 'Big Bang Theory'],
    'Друзі (Friends)': ['Друзі', 'Friends'], 'Баскетбол / NBA': ['NBA'], 'UFC / MMA': ['UFC', 'MMA'],
    'Прокляття: Автоматизація': ['Nier Automata', 'NieR: Automata', 'NieR Automata'], 'Цей чудовий світ!': ['Коносуба', 'KonoSuba', 'Цей чудовий світ!'],
    'Re:Zero. Життя в альтернативному світі з нуля': ['Re:Zero', 'Життя в альтернативному світі з нуля', 'Життя з нуля в іншому світі'],
    'Майстер меча Онлайн': ['Sword Art Online', 'Майстер меча Онлайн', 'SAO'], 'Улюблений під Франксе': ['Darling In Franx', 'Darling in the Franxx', 'Милий у Франксі', 'Улюблений під Франксе'],
    'Данганронпа': ['Danganronpa', 'Данганронпа'], 'Андертейл': ['Undertale', 'Андертейл'], 'Хэллтэйкер': ['Helltaker'],
    'Людина-бензопила': ['Chainsaw Man', 'Людина-бензопила', 'Людина бензопила'], 'Ванпачмен': ['Ванпанчмен', 'One Punch Man'],
    'Дандадан': ['Дандадан', 'Dandadan'], 'Onmyoji (Онмьодзі)': ['Onmyoji', 'Онмьодзі'], 'Идолмастер': ['Idolmaster', 'Ідолмастер', 'Идолмастер', 'THE iDOLM@STER'],
    'Червоний, Білий, Чорний, Жовтий': ['RWBY'], 'Скейт: Нескінченність': ['SK8', 'Скейт: Нескінченність', 'Скейт Нескінченність'],
    'Волейбол!!': ['Волейбол!!', 'Волейбол', 'Haikyu'], "Сім'я шпигуна": ["Сім'я шпигуна", 'Cемья шпиона', 'Spy x Family'],
}
# назви, якими тайтл упізнається серед товарів збірних груп Prom («Інші»)
ROUTE = {
    'chainsaw': ['Chainsaw Man', 'Людина-бензопила', 'Человек-бензопила'], 'jjk': ['Мистецтво заклинань', 'Магічна битва', 'Jujutsu'],
    'gup': ['Анчові', 'Момо Кавасіма', 'Акіяма Юкарі', 'Girls und Panzer'], 'vocaloid': ['Hatsune Miku', 'Хатсуне Міку', 'Міку Хатсуне', 'Тето Касане', 'Проект Секай', 'Vocaloid'],
    'gosling': ['Гослінг'], 'genshin': ['Kamisato Ayaka', 'Genshin'], 'hsr': ['MARCH 7TH', 'Star Rail'],
}

# товари групи «Селебріті», які насправді герої серіалів і фільмів: (регулярний вираз у назві, куди)
CELEB_ROUTE = [
    (r'сутінки|twilight', ('col', 'twilight')), (r'щоденники вампіра|сальваторе', ('col', 'tvd')), (r'гослінг', ('col', 'gosling')),
    (r'\bдрузі\b|\bfriends\b', ('title', 'Друзі')), (r'теорія великого вибуху|big bang theory', ('title', 'Теорія великого вибуху')),
    (r'\bофіс\b|the office', ('title', 'Офіс')), (r'надприродне|supernatural', ('title', 'Надприродне')),
    (r'постукай в мої двері', ('title', 'Турецькі серіали')), (r'феттель|vettel|райкконен|ферстаппен|леклер|хемілтон|hamilton', ('col', 'f1')),
    (r'\bloki\b|\bлокі\b', ('title', 'Marvel')), (r'buffy|баффі', ('title', 'Баффі')),
]
MOVIES |= {'Офіс', 'Надприродне', 'Баффі'}

# тайтли, які впізнаємо за словами в назві товару зі збірної групи «Інші»: (слова, тайтл)
TITLE_ROUTE = [
    ('хазбін', 'Готель Хазбін і Helluva Boss'), ('hazbin', 'Готель Хазбін і Helluva Boss'), ('helluva', 'Готель Хазбін і Helluva Boss'),
    ('heluva', 'Готель Хазбін і Helluva Boss'), ('пекельний бос', 'Готель Хазбін і Helluva Boss'),
    ('stellar blade', 'Stellar Blade'), ('dark souls', 'Dark Souls'), ('call of duty', 'Call of Duty'), ('baldurs gate', "Baldur's Gate 3"),
    ('metal gear', 'Metal Gear'), ('arcane', 'League of Legends'), ('аркейн', 'League of Legends'), ('browndust', 'Brown Dust 2'),
    ('snowbreak', 'Snowbreak'), ('пірати карибського', 'Пірати Карибського моря'), ('південний парк', 'Південний парк'),
    ('дівчина зайка', 'Дівчинка-зайка (Bunny Girl Senpai)'), ('дівчинка зайка', 'Дівчинка-зайка (Bunny Girl Senpai)'),
    ("heaven official's blessing", 'Благословення небожителів'), ('oshi no ko', 'Оші но Ко'), ('корона провини', 'Корона провини'),
    ('guilty crown', 'Корона провини'), ('resident evil', 'Resident Evil'), ('pyramidhead', 'Silent Hill'), ('monster girls encyclopedia', None),
    ('kingdom hearts', 'Kingdom Hearts'), ('королівство сердець', 'Kingdom Hearts'), ('k: повернення королів', 'K'),
]
GAMES |= {'Stellar Blade', 'Dark Souls', 'Call of Duty', "Baldur's Gate 3", 'Metal Gear', 'Brown Dust 2', 'Snowbreak', 'Silent Hill', 'Kingdom Hearts'}
MOVIES |= {'Пірати Карибського моря', 'Південний парк'}
ROUTE['music'] = ['Nirvana', 'The Weeknd', 'The Weekend', 'Курт Кобейн']
ROUTE['vocaloid'] += ['UTAU', 'HATSUNE MIKU', 'Міку Хатсуне']

# заголовок сторінки колекції, якщо «Дакімакури + назва» звучить криво
H1 = {'Авто': 'Дакімакури з автомобілями', 'Баскетбол і NBA': 'Дакімакури з баскетболістами NBA', 'UFC і MMA': 'Дакімакури з бійцями UFC і MMA',
      'Мультфільми та Disney': 'Дакімакури з героями мультфільмів', 'Друзі': 'Дакімакури з героями серіалу «Друзі»',
      'Теорія великого вибуху': 'Дакімакури з героями «Теорії великого вибуху»', 'VTuber та Hololive': 'Дакімакури VTuber та Hololive'}
