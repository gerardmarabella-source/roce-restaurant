/* Carta de ROCE Restaurant & Cocktails. Fuente: los PDF de la carta impresa (menú, bebidas y postres, noviembre 2026).
   Para cambiar un precio o un plato, se edita aquí. Alérgenos: sacados de los iconos de cada plato en el PDF.
   Plato: { n: nombre, p: precio, es, en, al: [alérgenos], q: aclaración junto al nombre } */
window.ROCE_CARTA = (function () {
  var D = function (n, p, es, en, al, q) { return { n: n, p: p, es: es || '', en: en || '', al: al ? al.split(' ') : [], q: q || '' }; };
  var L = function (n, p, sub) { return { n: n, p: p, sub: sub || '' }; };           // bebida en una línea
  var S = function (n, copa, shot) { return { n: n, p: copa, p2: shot || '' }; };    // destilado: copa y chupito

  return [
    { id: 'menu', title: 't-menu', tone: 'food', label: { es: 'Menú', en: 'Menu' }, sections: [
      { h: 'starters', t: 'Starters', items: [
        D('Burrata Rocher', '14,50', 'Burrata cremosa, tomate confitado, coulis de granada, pesto de albahaca y almendra crujiente.', 'Creamy burrata with confit tomato, pomegranate coulis, basil pesto and crunchy almond.', 'leche sesamo frutos'),
        D('Croqueta Pekín', '3,50', 'Pato confitado con salsa Pekín, cebolla encurtida, jengibre, sésamo y mayonesa ROCE.', 'Duck confit, with Peking sauce, pickled onion, ginger, sesame and ROCE mayonnaise.', 'gluten huevo leche sesamo', '1 ud.'),
        D('Croqueta de langostino al carbón', '4,00', 'Langostino a la brasa con bisque, lima, cebolla encurtida y mayonesa ahumada.', 'Chargrilled prawn with bisque, lime, pickled onion and smoked mayonnaise.', 'gluten apio crustaceos huevo leche', '1 ud.'),
        D('Croqueta de boletus salvaje', '3,50', 'Boletus, shiitake y trompeta de la muerte con mantequilla de avellana, parmesano curado y crema de parmesano.', 'Porcini, shiitake and black trumpet mushrooms with hazelnut butter, aged Parmesan and Parmesan cream.', 'gluten huevo leche frutos', '1 ud.'),
        D('Alcachofa crujiente', '13,50', 'Alcachofa dorada sobre crema de parmesano, limón quemado, avellana tostada y aceite verde.', 'Golden artichoke on Parmesan cream with burnt lemon, toasted hazelnut and green oil.', 'frutos leche'),
        D('Patatas artesanas', '9,50', 'Patatas en doble cocción con nuestras 4 salsas ROCE: Roja, Verde, Fuego y Yogur Limón.', 'Twice-cooked potatoes with our four ROCE sauces: Red, Green, Fire and Lemon Yoghurt.', 'huevo leche')
      ] },
      { h: 'con-las-manos', t: 'Con las manos', items: [
        D('Sándwich de ternera Black Angus', '18,00', 'Black angus a la brasa en brioche con queso ahumado, cebolla caramelizada, mayo de ajo negro y chimichurri.', 'Chargrilled Black Angus on brioche with smoked cheese, caramelised onion, black garlic mayo and chimichurri.', 'gluten huevo leche'),
        D('Brioche de costilla 12 h', '15,50', 'Costilla de ternera cocinada 12 h en brioche con su jugo, mayonesa ahumada y encurtidos.', 'Beef rib slow-cooked for 12 hours, on brioche with its own jus, smoked mayonnaise and pickles.', 'huevo gluten'),
        D('Burger ROCE', '15,50', 'Smash de vacuno en brioche con queso ahumado, cebolla caramelizada, pepinillo y salsa ROCE.', 'Smashed beef patty on brioche with smoked cheese, caramelised onion, gherkin and ROCE sauce.', 'gluten huevo leche')
      ] },
      { h: 'veggies', t: 'Veggies', items: [
        D('Ensalada ROCE', '13,00', 'Hojas verdes, aguacate, tomate cherry, cebolla encurtida, queso de cabra y frutos secos con vinagreta cítrica.', 'Mixed leaves, avocado, cherry tomatoes, pickled onion, goat’s cheese and nuts with citrus vinaigrette.', 'frutos leche'),
        D('Puerro a la brasa · queso azul', '13,50', 'Puerro a la brasa con crema de queso azul, yema curada, avellana tostada y limón quemado.', 'Chargrilled leek with blue cheese cream, cured egg yolk, toasted hazelnut and burnt lemon.', 'huevo frutos leche'),
        D('Setas · parmesano · miso', '13,50', 'Setas a la brasa con crema de parmesano y miso, yema curada, cebolla crujiente y aceite verde.', 'Chargrilled mushrooms with parmesan and miso cream, cured egg yolk, crispy onion and green oil.', 'huevo soja leche')
      ] },
      { h: 'del-mar', t: 'Del mar', items: [
        D('Salmón marinado en miso', '17,50', 'Lomo de salmón marinado en miso con verduras a la brasa, salsa cítrica, sésamo y cebolla encurtida.', 'Miso-marinated salmon fillet with chargrilled vegetables, citrus sauce, sesame and pickled onion.', 'pescado soja sesamo'),
        D('Tartar de atún rojo · crujiente · granada', '19,50', 'Atún rojo cortado a cuchillo con aguacate, mango, granada, ponzu de lima, huevas y chips de boniato.', 'Hand-cut bluefin tuna with avocado, mango, pomegranate, lime ponzu, roe and sweet potato crisps.', 'pescado soja'),
        D('Pulpo al carbón', '19,50', 'Pulpo a la brasa sobre patata crujiente con Roja ROCE, crema de ajo, lima y hierbas frescas.', 'Chargrilled octopus on crispy potato with ROCE red sauce, garlic cream, lime and fresh herbs.', 'moluscos'),
        D('Lubina a la brasa', '22,00', 'Lubina a la brasa · crema de temporada · verduras de temporada a la brasa · salsa cítrica ROCE.', 'Chargrilled sea bass with seasonal cream and vegetables and ROCE citrus sauce.', 'pescado')
      ] },
      { h: 'brasa', t: 'Brasa', items: [
        D('Pollo braseado', '15,50', 'Pollo de corral a la brasa con crema de maíz y lima, ajo asado, Salsa Fuego ROCE y DUKA ROCE.', 'Chargrilled free-range chicken with sweetcorn and lime cream, roasted garlic, ROCE fire sauce and ROCE dukkah.', 'sesamo'),
        D('Solomillo de vacuno', '25,50', 'Solomillo a la brasa con salsa de pimienta negra, boniato al carbón y setas de temporada.', 'Chargrilled beef fillet with black pepper sauce, charcoal-roasted sweet potato and seasonal mushrooms.', 'leche'),
        D('Entrecot madurado', '32,50', 'Entrecot madurado a la brasa con chimichurri verde, ajo negro y patata crujiente.', 'Chargrilled dry-aged entrecôte with green chimichurri, black garlic and crispy potatoes.'),
        D('Costilla de ternera 12 h', '30,00', 'Costilla glaseada a baja temperatura, crema de boniato ahumado y su propio jugo.', 'Slow-cooked glazed beef rib with smoked sweet potato cream and its own jus.'),
        D('Tomahawk', '80,00/kg', 'Vaca madurada a la brasa (aprox. 1,5kg) con patatas asadas y chimichurri verde.', 'Chargrilled dry-aged beef (approx. 1.5kg) with roast potatoes and green chimichurri.', '', 'para 4 personas')
      ] },
      { h: 'para-acompanar', t: 'Para acompañar', items: [
        D('Boniato asado a la brasa', '5,50', 'Boniato asado a la brasa con crema de yogur y lima, aceite de hierbas y especias.', 'Chargrilled roast sweet potato with yoghurt and lime cream, herb oil and spices.', 'leche'),
        D('Patatas rojas crujientes', '5,00', 'Patata confitada ligeramente aplastada y terminada al horno con ajo, romero y sal en escamas.', 'Confit potatoes, lightly crushed and oven-finished with garlic, rosemary and sea salt flakes.'),
        D('Piquillos caramelizados', '6,00', 'Pimientos del piquillo salteados y caramelizados con mantequilla, vinagre de Jerez y un toque de agave.', 'Piquillo peppers sautéed and caramelised with butter, sherry vinegar and a touch of agave.', 'leche'),
        D('Espárragos con parmesano', '5,50', 'Espárragos verdes con rúcula, parmesano laminado y vinagreta de limón.', 'Green asparagus with rocket, shaved Parmesan and lemon vinaigrette.', 'leche'),
        D('Ensalada verde', '6,00', 'Canónigos, espinaca baby, rúcula, escarola, edamame y manzana verde con vinagreta cítrica.', 'Lamb’s lettuce, baby spinach, rocket, endive, edamame and green apple with citrus vinaigrette.', 'soja'),
        D('Pan de masa madre con AOVE', '3,50', 'Para acompañar tus platos.', 'To accompany your dishes.', 'gluten')
      ] }
    ] },

    { id: 'celebracion', title: 't-celebracion', tone: 'fiesta', label: { es: 'Celebración', en: 'Celebration' },
      foot: { es: '60€ Incluye postre, dos bebidas y una botella de vino para 4 personas', en: '60€ Incluye postre, dos bebidas y una botella de vino para 4 personas' },
      note: { es: 'Consulta los alérgenos con nuestro equipo.', en: 'Please ask our team about allergens.' },
      sections: [
      { h: 'entrantes', t: 'Entrantes', lead: 'Al centro de la mesa', items: [
        D('Croqueta de carrillera ibérica y ajo negro', '', 'Cremosa, crujiente y acompañada de un toque de jugo reducido.'),
        D('Puerro a la brasa, romesco de avellana y Jerez', '', 'Dulzor vegetal, tostado y acidez.'),
        D('Langostino a la brasa, mantequilla tostada y cítricos', '', 'Sabor concentrado y acabado brillante.'),
        D('Vieiras a la brasa, crema de coliflor tostada, avellana y manzana verde', '', 'Vieiras marcadas a la plancha, crema sedosa de coliflor asada, avellana tostada y un toque de manzana verde.'),
        D('Tartaleta de setas de temporada, castaña y jugo de hongos', '', 'Un bocado cálido y elegante, con contrastes de textura y un intenso sabor umami.')
      ] },
      { h: 'principal', t: 'Principal', lead: 'A elegir uno', items: [
        D('Bacalao a la brasa', '', 'Crema de cebolla tostada, mejillones, aceite de perejil y jugo marino.'),
        D('Pluma ibérica', '', 'Manzana ahumada, cebolla tostada y jugo de Oloroso.'),
        D('Opción vegana · Milhojas crujiente de patata, setas y trufa', '', 'Capas finas de patata, duxelle de setas, crema de trufa y jugo de setas.')
      ] }
    ] },

    { id: 'postres', title: 't-desserts', tone: 'food', label: { es: 'Postres', en: 'Desserts' },
      foot: { es: 'Sugerencia: acompaña tus postres con una copa de Tokaji 3 Puttonyos · 9,00', en: 'Suggestion: pair your dessert with a glass of Tokaji 3 Puttonyos · 9,00' },
      sections: [ { h: 'postres', t: 'Postres', items: [
        D('Tarta de queso casera y cremosa', '6,00', 'Ligeramente tostada y de interior fundente.', 'Homemade cheesecake, lightly toasted with a creamy, melting centre.', 'gluten huevo leche'),
        D('Torrija de brioche con crema de pistacho', '7,00', 'Con helado de leche merengada.', 'Brioche French toast with pistachio cream and cinnamon-and-lemon milk ice cream.', 'gluten huevo leche frutos'),
        D('Milhojas ROCE', '6,00', 'Hojaldre caramelizado, crema, nata y fruta fresca.', 'Mille-feuille with caramelised puff pastry, custard, whipped cream and fresh fruit.', 'gluten huevo leche'),
        D('Flan casero de turrón', '5,00', 'Caramelo y almendra tostada.', 'Homemade Spanish almond nougat crème caramel with toasted almonds.', 'huevo leche frutos'),
        D('Tiramisú de café y avellana', '6,00', 'Mascarpone, café, praliné y cacao.', 'Coffee and hazelnut tiramisu with mascarpone, praline and cocoa.', 'gluten huevo leche frutos'),
        D('Manzana asada', '5,50', 'Sobre crumble crujiente sin gluten, yogur griego, nueces tostadas y miel.', 'Baked apple with crunchy gluten-free crumble, Greek yoghurt, toasted walnuts and honey.', 'leche frutos'),
        D('Brownie de chocolate y nueces', '6,50', 'Con caramelo salado y helado de vainilla.', 'Chocolate and walnut brownie with salted caramel and vanilla ice cream.', 'huevo gluten leche frutos')
      ] } ] },

    { id: 'cocteles', title: 't-cocktails', tone: 'bar', label: { es: 'Cócteles', en: 'Cocktails' }, sections: [
      { h: 'spritz', t: 'Spritz', items: [
        D('Aperol Spritz', '7,90', 'Prosecco, Aperol, soda y naranja.', 'Prosecco, Aperol, soda and orange.'),
        D('Hugo Spritz', '9,00', 'Prosecco, licor o cordial de flor de saúco, soda, menta fresca y lima.', 'Prosecco, elderflower liqueur or cordial, soda, fresh mint and lime.'),
        D('Limoncello Spritz', '7,90')
      ] },
      { h: 'cocteles-clasicos', t: 'Cócteles clásicos', items: [
        D('Paloma', '10,00', 'Tequila Astral, sirope de pomelo rosa, lima, jarabe de goma y soda.', 'Astral tequila, pink grapefruit, lime, sugar syrup and soda.'),
        D('Daiquiri', '10,00', 'Ron Bacardi, lima y jarabe de goma.', 'Bacardi rum, lime and sugar syrup.'),
        D('Espresso Martini', '12,00', 'Vodka Smirnoff, licor Kahlúa y espresso.', 'Smirnoff vodka, Kahlúa liqueur and espresso.'),
        D('Negroni', '12,00', 'Gin Tanqueray, Campari y vermut rojo.', 'Tanqueray gin, Campari and red vermouth.'),
        D('Margarita', '11,00', 'Tequila Astral, Cointreau, lima y borde de sal.', 'Astral tequila, Cointreau, lime and salt rim.'),
        D('Porn Star Martini', '13,00', 'Vodka, passoa, puré de maracuyá, sirope de vainilla, lima, jarabe de goma y Magic Velvet.', 'Vodka, passoa, passion fruit purée, vanilla syrup, lime, sugar syrup and Magic Velvet.')
      ] },
      { h: 'cocteles-de-autor', t: 'Cócteles de autor', items: [
        D('La Terreta', '10,00', 'Vodka, naranja, puré de mango, sirope de romero, lima, jarabe de goma y soda.', 'Vodka, orange, mango purée, rosemary syrup and soda.'),
        D('Chai Chai Chá', '12,00', 'Ron de té chai, puré de mango, lima, sirope de ron, aguamaría y ginger ale.', 'Chai tea rum, mango purée, lime, rum syrup, aguamaria and ginger ale.'),
        D('S*x by the Fire', '11,00', 'Whisky de pera y canela, vermut rojo y bitter de cacao.', 'Pear and cinnamon whisky, red vermouth and cacao bitters.'),
        D('Burning Eden', '13,00', 'Red soul, puré de manzana, sirope de romero, lima, jarabe de goma, bitter de humo y ginger ale.', 'Red soul, apple purée, rosemary syrup, lime, sugar syrup, smoke bitters and ginger ale.'),
        D('What the F*ck is Matcha', '12,00', 'Vodka Smirnoff, sirope de matcha, sirope de pepino, lima, jarabe de goma y ginger beer.', 'Vodka, matcha syrup, cucumber syrup, lime, sugar syrup and ginger beer.'),
        D('Antídoto', '12,00', 'Ron Brugal, vermut tinto, agua de miel de jengibre, lima, jarabe de goma, bitter de cacao y ginger ale.', 'Brugal rum, red vermouth, ginger honey water, lime, sugar syrup, cacao bitters and ginger ale.'),
        D('Sushi Martini', '12,00', 'Gin Roku, vermut blanco, sirope de pepino, lima, jarabe de goma, guisante de wasabi y Magic Velvet.', 'Roku gin, white vermouth, cucumber syrup, lime, sugar syrup, wasabi pea and Magic Velvet.'),
        D('Porn Corn', '12,00', 'Ron de palomitas, Frangelico, lima, sirope de ron, bitter tiki y ginger ale.', 'Popcorn rum, Frangelico, lime, rum syrup, tiki bitters and ginger ale.'),
        D('Bacchanal', '11,00', 'Gin Tanqueray, mosto de uva blanca, sirope de anís, lima, jarabe de goma y Magic Velvet.', 'Tanqueray gin, white grape juice, anise syrup, lime, sugar syrup and Magic Velvet.'),
        D('Sin City', '13,00', 'Tequila Astral, Cointreau, agua de miel de romero, lima, jarabe de goma, tabasco de jalapeños, bitter de humo.', 'Astral tequila, Cointreau, rosemary honey water, lime, sugar syrup, jalapeño tabasco and smoke bitters.')
      ] },
      { h: 'cocteles-sin-alcohol', t: 'Cócteles sin alcohol', items: [
        D('Basil Instinct', '11,00', 'Gin Tanqueray 0.0, puré de kiwi, lima, jarabe de goma, aguamarina y ginger beer.', 'Tanqueray 0.0 gin, kiwi purée, basil, lime, sugar syrup, aguamarina and ginger beer.'),
        D('Passional Sober', '10,00', 'Sirope de ron, lima, puré de maracuyá, sirope de vainilla, hierbabuena y soda.', 'Rum syrup, lime, passion fruit purée, vanilla syrup, spearmint and soda.'),
        D('Mohombi', '10,00', 'Puré de coco, sirope de cardamomo, sirope de vainilla, lima, sirope de ron y ginger ale.', 'Coconut purée, cardamom syrup, vanilla syrup, lime, rum syrup and ginger.'),
        D('Dexter’s Mind', '12,00', 'Gin Tanqueray 0.0, puré de manzana, sirope de pepino, albahaca, lima, jarabe de goma y Magic Velvet.', 'Tanqueray 0.0 gin, apple purée, cucumber syrup, basil, lime, sugar syrup and Magic Velvet.')
      ] }
    ] },

    { id: 'vinos', title: 't-wines', tone: 'bar', label: { es: 'Vinos', en: 'Wines' }, sections: [
      { h: 'por-copas', t: 'Por copas', items: [
        L('Rippa Dorii', '4,50', 'Verdejo, Rueda'), L('Casagrande 2021', '4,00', 'Bobal (D.O. Utiel-Requena)'), L('Viña Zorzal', '5,00', 'Chardonnay (Navarra)'),
        L('Mayela 2024', '5,00', 'Tempranillo (D.O. Rioja)'), L('Brezo Blanco 2025', '5,50', 'Godello (D.O. Bierzo)'), L('Divina Clementia', '6,00', 'Mencía (D.O. Ribeira Sacra)')
      ] },
      { h: 'blancos', t: 'Blancos', items: [
        { g: 'Albariño' }, L('Leirana - Forjas del Salnés 2025', '25,20', 'Rodrigo Méndez y Raúl Pérez (D.O. Rías Baixas)'),
        { g: 'Godello' }, L('Brezo Blanco 2025', '22,40', 'Bodegas Mengoba / Gregory Pérez (D.O. Bierzo)'), L('Divina Clementia 2024', '24,00', 'Raúl Suárez (D.O. Ribeira Sacra)'),
        { g: 'Verdejo y Viura' }, L('Rippa Dorii 2025', '14,00', 'Bodegas Ontañón (D.O. Rueda)'), L('Basa 2025', '17,50', 'Verdejo, Viura / Telmo Rodríguez (D.O. Rueda)'), L('Legaris Verdejo 2025', '23,00', 'Legaris, Valladolid (D.O. Rueda)'),
        { g: 'Chardonnay' }, L('Zorzal 2025', '15,60', 'Zorzal (D.O. Navarra)'), L('Chablis 2023', '47,60', 'Domaine Corinne et Jean-Pierre Grossot / Bourgogne'),
        { g: 'Coupages mediterráneos' }, L('Cullerot 2024', '27,00', 'Celler del Roure / Pablo Calatayud (D.O. Valencia)')
      ] },
      { h: 'rosados', t: 'Rosados', items: [ { g: 'Garnacha' }, L('Zorzal Rosado 2025', '15,60', 'Zorzal (D.O. Navarra)') ] },
      { h: 'espumosos', t: 'Espumosos', items: [
        { g: 'Cava' }, L('Roger de Flor Brut Nature', '18,00', 'Macabeo, Xarel.lo, Parellada / Penedès (D.O. Cava)'), L('Ars Collecta Blanc de Noirs', '32,00', 'Pinot Noir, Trepat y Xarel.lo (D.O. Cava)'), L('Clímax Brut Nature Rosat 2022', '39,00', 'Pinot Noir, Xarel.lo y Macabeo / Can Ràfols dels Caus (D.O. Cava)'),
        { g: 'Champagne' }, L('André Clouet Grande Réserve Blanc de Noirs', '57,00', '100% Pinot Noir, Grand Cru, André Clouet, Bouzy (Francia)'), L('Moët & Chandon Brut', '64,00', 'Champagne (Francia)'), L('Bollinger Special Cuvée', '105,00', 'Champagne (Francia)'), L('Perrier-Jouët Rosé', '117,00', 'Champagne (Francia)'), L('Dom Pérignon Vintage', '345,00', 'Champagne (Francia)'), L('Dom Pérignon Rosé Vintage', '535,00', 'Champagne (Francia)')
      ] },
      { h: 'tintos', t: 'Tintos', items: [
        { g: 'Tempranillo' }, L('Mayela 2024', '16,00', 'Bodegas Bideona (D.O. Rioja)'), L('Caliel Joven 2025', '17,00', 'Raúl Calvo (D.O. Ribera del Duero)'), L('Selvanevada 2022', '22,50', 'Tempranillo, Graciano, Garnacha, Mazuela, Villota · Jesús Madrazo y Carmen Pérez Garrigues (D.O. Rioja)'), L('Viña Pomal Crianza 2022', '23,00', 'Bodegas Bilbaínas, Haro, Rioja Alta (D.O. Rioja)'), L('Legaris Crianza 2021', '28,00', 'Legaris, Curiel de Duero (D.O. Ribera del Duero)'), L('San Cobate 2021', '31,50', 'Raúl Suárez (D.O. Ribera del Duero)'), L('Lanzaga 2021', '46,50', 'Tempranillo, Garnacha, Graciano, Bodega Lanzaga · Telmo Rodríguez y Pablo Eguzkiza (D.O. Rioja)'),
        { g: 'Monastrell, Bobal y mediterráneos' }, L('Clos Lojen 2025', '18,00', 'Bobal, Bodegas y Viñedos Ponce / Juan Antonio Ponce (D.O. Manchuela)'), L('Vermell 2024', '18,00', 'Monastrell, Garnacha Tintorera, Mandó · Celler del Roure / Pablo Calatayud (D.O. Valencia)'), L('Les Alcusses 2023', '19,00', 'Cabernet Sauvignon, Merlot, Monastrell, Tempranillo · Celler del Roure / Pablo Calatayud (D.O. Valencia)'), L('Casagrande 2021', '20,00', 'Bobal, Vinícola Requenense (D.O. Utiel-Requena)'), L('El Tiempo que nos Une 2025', '21,00', 'Monastrell, Bodega Cerrón (D.O. Jumilla)'),
        { g: 'Garnacha' }, L('Las Cabañuelas 2021', '22,00', 'Viñedos del Jorco / César Ruiz, Nacho Jiménez, Flequi Berruti y Raúl Pérez / D.O.P. Cebreros (Sierra de Gredos)'), L('Châteauneuf-du-Pape Télégramme 2023', '69,50', 'Grenache, Mourvèdre, Domaine du Vieux Télégraphe · Rhône (Francia)'),
        { g: 'Mencía' }, L('Divina Clementia 2022', '24,00', 'Raúl Suárez (D.O. Ribeira Sacra)'), L('Guímaro Finca Meixemán 2023', '41,60', 'Guímaro (D.O. Ribeira Sacra)'),
        { g: 'Nebbiolo' }, L('Barolo Berri Comune di La Morra 2022', '78,00', 'Trediberri, Barolo (Italia)'),
        { g: 'Merlot' }, L('Emilien 2020', '83,00', 'Merlot, Cabernet Franc, Malbec, Carménère, Chateau Le Puy, Lussac-Saint-Émilion / Bordeaux (Francia)'),
        { g: 'Pinot Noir' }, L('Gevrey-Chambertin Vieilles Vignes 2022', '98,00', 'Domaine Faiveley / Bourgogne (Francia)'), L('Gevrey-Chambertin Cuvée de l’Aulne 2023', '145,00', 'Laurent Ponsot / Bourgogne (Francia)')
      ] }
    ] },

    { id: 'destilados', title: 't-spirits', tone: 'bar', label: { es: 'Destilados', en: 'Spirits' },
      foot: { es: 'Todos nuestros combinados pueden servirse con Red Bull (+1,50).', en: 'All our mixed drinks can be served with Red Bull (+1,50).' },
      sections: [
      { h: 'ginebras', t: 'Ginebras', cols: ['copa'], items: [
        S('Tanqueray', '10,00'), S('Tanqueray N° Ten', '12,00'), S('Tanqueray 0,0 sin alcohol', '10,00'), S('Bombay Sapphire', '10,00'), S('Beefeater', '10,00'), S('Larios 12', '9,00'), S('Larios Rosé', '9,00'), S('Puerto de Indias Fresa', '10,00'), S('Puerto de Indias Mora', '10,00'), S('Puerto de Indias Melón', '10,00'), S('Hendrick’s', '12,00'), S('Nordés', '12,00'), S('Bulldog', '12,00'), S('Martin Miller’s', '15,00'), S('Roku', '15,00'), S('Gin Mare', '15,00')
      ] },
      { h: 'vodka', t: 'Vodka', cols: ['copa', 'chupito'], items: [
        S('Smirnoff', '8,00'), S('Absolut', '10,00', '4,00'), S('Cîroc', '12,00'), S('Cîroc Apple', '13,00'), S('Cîroc Pineapple', '13,00'), S('Cîroc Coconut', '13,00'), S('Cîroc Peach', '13,00'), S('Cîroc Red Berry', '13,00'), S('Grey Goose', '17,00', '8,50')
      ] },
      { h: 'whisky', t: 'Whisky', cols: ['copa', 'chupito'], items: [
        S('DYC 8', '10,00', '4,00'), S('Jim Beam', '10,00', '4,00'), S('Johnnie Walker Red Label', '10,00', '4,50'), S('Jameson', '11,00', '4,00'), S('Jack Daniel’s', '12,00', '5,00'), S('Johnnie Walker Black Label', '15,00', '6,00'), S('Toki', '17,00', '8,00'), S('The Macallan 12', '23,00', '10,00'), S('Laphroaig', '23,00', '10,00'), S('Hibiki', '25,00', '12,00')
      ] },
      { h: 'ron', t: 'Ron', cols: ['copa', 'chupito'], items: [
        S('Malibú', '9,00'), S('Negrita', '9,00', '4,00'), S('Brugal', '10,00', '4,00'), S('Barceló', '11,00', '4,00'), S('Havana Club 7', '11,00', '4,00'), S('Santa Teresa', '11,00', '4,00'), S('Brugal Doble Reserva', '12,00', '5,00'), S('Zacapa', '15,00', '6,00')
      ] },
      { h: 'licores', t: 'Licores', cols: ['copa'], items: [
        S('Terry', '6,00'), S('Amaretto', '6,00'), S('Baileys', '6,00'), S('Frangelico', '6,00'), S('Licor 43', '6,00'), S('Jägermeister con hielo', '6,00'), S('Jägermeister + Red Bull', '13,00')
      ] },
      { h: 'chupitos', t: 'Chupitos', cols: ['chupito'], items: [
        S('Limoncello', '3,00'), S('Hierbas', '3,00'), S('Mistela', '3,00'), S('Cazalla', '3,00'), S('Tequila de fresa', '3,00'), S('Jägermeister', '5,00'), S('Tequila Astral', '8,00'), S('Tequila Astral Reposado', '9,00'), S('Tequila Don Julio Blanco', '10,00'), S('Tequila Don Julio Reposado', '12,00')
      ] }
    ] },

    { id: 'bebidas', title: 't-drinks', tone: 'food', label: { es: 'Cervezas y más', en: 'Beer & soft' }, sections: [
      { h: 'cervezas', t: 'Cervezas', items: [
        { g: 'Tercios' }, L('Alhambra Reserva 1925', '3,50'), L('Alhambra Reserva Roja', '4,00'), L('Mahou 5 Estrellas', '3,30'), L('Mahou Reserva', '3,80'), L('Mahou Session IPA', '4,00'), L('Mahou sin gluten', '3,50'), L('Mahou 0,0 Tostada', '3,30'), L('Coronita', '3,80'), L('Tinto de verano', '3,50'),
        { g: 'Dobles' }, L('Mahou Clásica', '3,00'), L('Radler', '3,00'), L('Mahou Maestra', '4,20')
      ] },
      { h: 'vermuts', t: 'Vermuts', items: [ L('Vermut casero ROCE', '3,50'), L('Martini Rosso', '4,50'), L('Martini Bianco', '4,50'), L('Martini Fiero', '5,00'), L('Martini Rosato', '4,50') ] },
      { h: 'refrescos', t: 'Refrescos', items: [
        L('Pepsi', '3,50'), L('Pepsi Max', '3,50'), L('Kas Limón', '3,50'), L('Kas Naranja', '3,50'), L('Aquarade Limón', '3,50'), L('Aquarade Naranja', '3,50'), L('7Up', '3,50'), L('Lipton', '3,50'), L('Tónica', '3,50'), L('Red Bull', '4,50', 'Sin azúcar, coco, albaricoque y sandía')
      ] },
      { h: 'aguas', t: 'Aguas', items: [ L('Solán de Cabras 0,5 L', '2,50'), L('Solán de Cabras con gas 0,5 L', '2,80') ] }
    ] }
  ];
})();
