/* ROCE · Carta digital (se abre solo con el QR de las mesas; no hay ningún enlace desde roce.es).
   Todo el contenido está aquí: para cambiar un plato o un precio se edita este archivo.
   Alérgenos: números oficiales de la carta (1 Gluten … 14 Moluscos). `img` (opcional) = foto del plato, p. ej. "/carta/img/001.jpg". */
window.CARTA = {
  allergens: [
    { n: 1, es: 'Gluten', en: 'Gluten' }, { n: 2, es: 'Crustáceos', en: 'Crustaceans' }, { n: 3, es: 'Huevo', en: 'Egg' },
    { n: 4, es: 'Pescado', en: 'Fish' }, { n: 5, es: 'Cacahuete', en: 'Peanuts' }, { n: 6, es: 'Soja', en: 'Soy' },
    { n: 7, es: 'Leche', en: 'Milk' }, { n: 8, es: 'Frutos de cáscara', en: 'Tree nuts' }, { n: 9, es: 'Apio', en: 'Celery' },
    { n: 10, es: 'Mostaza', en: 'Mustard' }, { n: 11, es: 'Sésamo', en: 'Sesame' }, { n: 12, es: 'Sulfitos', en: 'Sulphites' },
    { n: 13, es: 'Altramuces', en: 'Lupin' }, { n: 14, es: 'Moluscos', en: 'Molluscs' }
  ],
  sections: [
    {
      id: 'kitchen', color: 'kraft', title: { es: 'Kitchen', en: 'Kitchen' },
      groups: [
        {
          title: { es: 'Desayunos', en: 'Breakfast' },
          blocks: [
            {
              title: { es: 'Tostadas', en: 'Toasts' }, note: { es: 'Hasta las 12:00 · pan de masa madre', en: 'Until 12:00 · sourdough bread' },
              items: [
                { code: '000', name: '000', al: [1], price: 3.9, es: 'Pan de masa madre, tomate de rama triturado y AOVE.', en: 'Sourdough, grated vine tomato and extra virgin olive oil.' },
                { code: '001', name: '001', al: [1, 11], price: 7.5, es: 'Pan de masa madre, guacamole, pepino, rabanito y semillas.', en: 'Sourdough, guacamole, cucumber, radish and seeds.' },
                { code: '002', name: '002', al: [1, 3, 7], price: 10.5, es: 'Pan de masa madre, manzana confitada, huevos pochados, holandesa de AOVE y rúcula.', en: 'Sourdough, candied apple, poached eggs, olive-oil hollandaise and rocket.' },
                { code: '003', name: '003', al: [1, 3, 4, 7], price: 11.5, es: 'Pan de masa madre, salmón ahumado, queso cottage, huevo poché, eneldo y limón.', en: 'Sourdough, smoked salmon, cottage cheese, poached egg, dill and lemon.' },
                { code: '004', name: '004', al: [1, 4], price: 9.5, es: 'Pan de masa madre, pimiento y berenjena asados, ventresca de atún, cebolla y AOVE.', en: 'Sourdough, roasted pepper and aubergine, tuna belly, onion and olive oil.' },
                { code: '005', name: '005', al: [1, 11], price: 6.5, es: 'Pan de masa madre, hummus de remolacha, berenjena asada, rúcula y semillas.', en: 'Sourdough, beetroot hummus, roasted aubergine, rocket and seeds.' },
                { code: '006', name: '006', al: [1, 3], price: 7.5, es: 'Pan artesano con mermelada y 2 huevos a elegir (revueltos, pochados o fritos).', en: 'Artisan bread with jam and 2 eggs your way (scrambled, poached or fried).' }
              ],
              extras: { title: { es: 'Extras para tostadas', en: 'Toast extras' }, list: [[{ es: 'Bacon', en: 'Bacon' }, 2.5], [{ es: 'Aguacate', en: 'Avocado' }, 2.5], [{ es: 'Salmón', en: 'Salmon' }, 3.5], [{ es: 'Huevo', en: 'Egg' }, 2], [{ es: 'Jamón', en: 'Ham' }, 3]] }
            },
            {
              title: { es: 'Açaí & Yogur', en: 'Açaí & Yogurt' }, note: { es: 'Todo el día', en: 'All day' },
              items: [
                { name: 'Dark Açaí', al: [5, 8], price: 9.5, es: 'Açaí, plátano, granola, crema de cacahuete y nibs de cacao.', en: 'Açaí, banana, granola, peanut cream and cacao nibs.' },
                { name: 'Shaka Açaí', al: [8], price: 9.5, es: 'Açaí, mango, plátano, coco y granola.', en: 'Açaí, mango, banana, coconut and granola.' },
                { name: 'Greek Freak', al: [7, 8], price: 7.5, es: 'Yogur griego, fruta de temporada, granola y miel.', en: 'Greek yogurt, seasonal fruit, granola and honey.' }
              ],
              extras: { title: { es: 'Extras', en: 'Extras' }, list: [[{ es: 'Fruta', en: 'Fruit' }, 2], [{ es: 'Granola', en: 'Granola' }, 1.5], [{ es: 'Crema de cacahuete', en: 'Peanut cream' }, 1.5]] }
            },
            {
              title: { es: 'Sándwiches', en: 'Sandwiches' }, note: { es: 'Desde las 12:00 · también en comidas', en: 'From 12:00 · also at lunch' },
              items: [
                { name: 'Chicken Joe', al: [1, 3], price: 11.5, es: 'Pollo a la brasa, bacon, tomate, hojas verdes y mayonesa de ajo asado.', en: 'Grilled chicken, bacon, tomato, green leaves and roasted garlic mayo.' },
                { name: 'Terra', al: [1, 11], price: 10.5, es: 'Hummus de remolacha, berenjena y calabacín asados, tomate seco, rúcula, tomate, hojas verdes y aliño de limón.', en: 'Beetroot hummus, roasted aubergine and courgette, sun-dried tomato, rocket, tomato, green leaves and lemon dressing.' },
                { name: 'New York 1888', al: [1, 7, 10], price: 13.5, es: 'Pastrami, queso suizo, pepinillos, mostaza ROCE y rúcula.', en: 'Pastrami, Swiss cheese, pickles, ROCE mustard and rocket.' },
                { name: 'Liguria', al: [1, 7, 8], price: 12.5, es: 'Pollo a la brasa, pesto verde, queso cheddar y queso Edam, rúcula.', en: 'Grilled chicken, green pesto, cheddar and Edam cheese, rocket.' }
              ]
            }
          ]
        },
        {
          title: { es: 'Comidas', en: 'Lunch' },
          note: { es: 'Desde las 12:00 · Platos complejos, ingredientes reales, sabores internacionales', en: 'From 12:00 · Complex dishes, real ingredients, international flavours' },
          blocks: [
            {
              title: { es: 'Starters', en: 'Starters' },
              items: [
                { name: 'Bloody Moon', al: [7, 8, 11], price: 14.5, es: 'Burrata inyectada con coulis de granada y frambuesa, carpaccio de tomate cherry confitado, higos baby, nuez caramelizada, DUKA ROCE y salsa chili berry.', en: 'Burrata injected with pomegranate and raspberry coulis, candied cherry tomato carpaccio, baby figs, caramelised walnut, ROCE DUKA and chili berry sauce.' },
                {
                  name: 'El Trío', note: { es: '3 uds', en: '3 pcs' }, al: [1, 3, 6, 7, 11], price: 13.5, es: 'Tortilla de maíz, cebolla encurtida y nuestras salsas.', en: 'Corn tortilla, pickled onion and our sauces.',
                  variants: [
                    { name: 'Pollo', al: [7], es: 'Pollo desmechado, piña, salsa yogur limón.', en: 'Pulled chicken, pineapple, lemon yogurt sauce.' },
                    { name: 'Pato Pekín', al: [1, 6, 11], es: 'Magret de pato, mango, salsa pekín.', en: 'Duck breast, mango, Peking sauce.' },
                    { name: 'Costilla', al: [3], es: 'Costilla de vaca a baja temperatura, aguacate y mayonesa ahumada.', en: 'Slow-cooked beef rib, avocado and smoked mayo.' }
                  ]
                },
                { name: 'Patatas Artesana', al: [3, 7], price: 9.5, es: 'Patata agria en doble cocción, crujiente al centro, con 4 salsas ROCE (más icónicas).', en: 'Double-cooked potato, crispy in the centre, with 4 ROCE sauces (the most iconic).' }
              ]
            },
            {
              title: { es: 'Pokes', en: 'Pokes' }, note: { es: 'Platos completos en bowl', en: 'Complete bowls' },
              items: [
                { name: 'Black Rice Chicken', al: [6, 11], price: 12.5, es: 'Arroz salvaje, pollo, edamame, aguacate, pepino, encurtidos, cebolla encurtida, mezcla verde, sésamo y salsa ROCE.', en: 'Wild rice, chicken, edamame, avocado, cucumber, pickles, pickled onion, mixed greens, sesame and ROCE sauce.' },
                { name: 'Black Rice Tuna', al: [4, 6, 11], price: 16.5, es: 'Arroz salvaje, atún, edamame, aguacate, pepino, encurtidos, cebolla encurtida, mezcla verde, sésamo y salsa ROCE.', en: 'Wild rice, tuna, edamame, avocado, cucumber, pickles, pickled onion, mixed greens, sesame and ROCE sauce.' },
                { name: 'Forest Walk', al: [6, 11], price: 12.5, es: 'Quinoa, kale, espinaca, aguacate, edamame, pepino, manzana, semillas, cebolla encurtida y hierbas frescas.', en: 'Quinoa, kale, spinach, avocado, edamame, cucumber, apple, seeds, pickled onion and fresh herbs.' }
              ]
            },
            {
              title: { es: 'Platos ROCE', en: 'ROCE plates' },
              items: [
                { name: 'Egg & Egg', al: [3, 11], price: 7.5, es: 'Huevos camperos, cecina, quinoa, mezcla verde, pepino brunoise, tomate cherry, bacon crujiente, semillas y salsa cítrica.', en: 'Free-range eggs, cured beef, quinoa, mixed greens, diced cucumber, cherry tomato, crispy bacon, seeds and citrus sauce.' },
                { name: 'Primitive Chicken', al: [3], price: 13.5, es: 'Pollo a la brasa, arroz salvaje, mango, pepino, mezcla verde, garbanzo artesano, maíz, cebolla encurtida, especias ROCE y mayonesa de ajo ahumado.', en: 'Grilled chicken, wild rice, mango, cucumber, mixed greens, artisan chickpeas, corn, pickled onion, ROCE spices and smoked garlic mayo.' },
                { name: 'Citric Nordic', al: [4, 11], price: 14.5, es: 'Salmón a la brasa, arroz salvaje, aguacate, pepino, cebolla encurtida, mezcla verde, sésamo, hierbas frescas y vinagreta cítrica.', en: 'Grilled salmon, wild rice, avocado, cucumber, pickled onion, mixed greens, sesame, fresh herbs and citrus vinaigrette.' },
                { name: 'Muuuuuucho Beef', al: [7], price: 16.5, es: 'Filete de ternera, patata, maíz, rúcula, cebolla encurtida, kikos, especias ahumadas y chimichurri verde.', en: 'Beef fillet, potato, corn, rocket, pickled onion, toasted corn, smoked spices and green chimichurri.' },
                { name: 'Falafel & Hummus', al: [11], price: 13.5, es: 'Falafel, hummus de remolacha, pepino, granada, col, mezcla verde, lenteja beluga, sésamo, tahini de limón y salsa yogur limón.', en: 'Falafel, beetroot hummus, cucumber, pomegranate, cabbage, mixed greens, beluga lentils, sesame, lemon tahini and lemon yogurt sauce.' },
                { name: 'La Huerta', al: [11], price: 12.5, es: 'Hummus de remolacha, arándanos, berenjena y calabacín asados, mezcla verde, brotes, albahaca, vinagreta cítrica, cebolla encurtida asada, DUKA ROCE y sal / oliva.', en: 'Beetroot hummus, blueberries, roasted aubergine and courgette, mixed greens, sprouts, basil, citrus vinaigrette, roasted pickled onion, ROCE DUKA and salt / olive oil.' }
              ]
            },
            {
              title: { es: 'Acompañamientos', en: 'Sides' },
              compact: true,
              items: [
                { name: 'Patata artesana', al: [3, 7], price: 3.5 }, { name: 'Garbanzo artesano', price: 3.5 }, { name: 'Frijoles marinados', price: 3.5 },
                { name: 'Maíz especiado', price: 3.5 }, { name: 'Boniato al carbón', price: 3.5 }
              ]
            },
            {
              title: { es: 'Extras', en: 'Extras' }, note: { es: 'Proteína', en: 'Protein' },
              compact: true,
              items: [
                { name: 'Huevo campero', al: [3], price: 2 }, { name: 'Falafel', al: [11], price: 3.5 }, { name: 'Cottage', al: [7], price: 2.5 },
                { name: 'Pollo marinado', price: 3.5 }, { name: 'Atún rojo', al: [4], price: 5.5 }, { name: 'Salmón', al: [4], price: 5.5 },
                { name: 'Filete de ternera', price: 9.5 }, { name: 'Entrecot madurado', price: 15 }, { name: 'Bacon crujiente', price: 2.5 }, { name: 'Hummus de remolacha', al: [11], price: 2.5 }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'bebidas', color: 'olive', title: { es: 'Bebidas', en: 'Drinks' },
      groups: [
        {
          title: { es: 'Drinks', en: 'Drinks' },
          blocks: [
            {
              title: { es: 'Cafés', en: 'Coffees' }, compact: true, alPending: true,
              items: [
                { name: 'Espresso', price: 2 }, { name: 'Double espresso', price: 2.5 }, { name: 'Cortado', price: 2.2 }, { name: 'Americano', price: 2.5 },
                { name: 'Latte', price: 3 }, { name: 'Flat white', price: 3.5 }, { name: 'Mocca latte', price: 3.9 }
              ],
              extras: { title: { es: 'Extras', en: 'Extras' }, list: [[{ es: 'Iced', en: 'Iced' }, '+0,50'], [{ es: 'Doble carga', en: 'Double shot' }, '+1,00'], [{ es: 'Vegetal barista', en: 'Barista plant milk' }, '+0,30'], [{ es: 'Con hielo', en: 'On ice' }, '+0,15'], [{ es: 'Descafeinado', en: 'Decaf' }, '']] }
            },
            {
              title: { es: 'Matcha & Tés', en: 'Matcha & Teas' }, compact: true, alPending: true,
              items: [
                { name: 'Matcha', price: 3.5 }, { name: 'Matcha latte', price: 4.5 }, { name: 'Iced matcha latte', price: 4.9 }, { name: 'Té verde', price: 2.2 },
                { name: 'Té negro', price: 2.2 }, { name: 'Té rojo', price: 2.2 }, { name: 'Rooibos', price: 2.2 }, { name: 'Manzanilla', price: 1.9 },
                { name: 'Menta poleo', price: 1.9 }, { name: 'Digestivo', price: 1.9 }
              ]
            },
            {
              title: { es: 'Smoothies', en: 'Smoothies' }, note: { es: 'Con fruta natural', en: 'Made with real fruit' }, alPending: true,
              items: [
                { code: '01', name: 'Marathon Rat', price: 6, es: 'Mango · Piña · Maracuyá · Zumo de naranja', en: 'Mango · Pineapple · Passion fruit · Orange juice', tag: { es: 'Aporta energía de forma natural.', en: 'Natural energy.' } },
                { code: '02', name: 'Purple Haze', price: 7, es: 'Açaí · Fresa · Plátano · Frutos rojos', en: 'Açaí · Strawberry · Banana · Red berries', tag: { es: 'Rico en antioxidantes y vitaminas.', en: 'Rich in antioxidants and vitamins.' } },
                { code: '03', name: 'Out of the F*cking Office', price: 6, es: 'Piña · Plátano · Coco · Yogur griego', en: 'Pineapple · Banana · Coconut · Greek yogurt', tag: { es: 'Cremoso, nutritivo y refrescante.', en: 'Creamy, nourishing and refreshing.' } },
                { code: '04', name: '404 Error Not Found', price: 6, es: 'Espinaca · Manzana verde · Pepino · Limón · Jengibre', en: 'Spinach · Green apple · Cucumber · Lemon · Ginger', tag: { es: 'Limpia, refresca y aporta fibra.', en: 'Cleansing, refreshing and full of fibre.' } },
                { code: '05', name: 'Red Lips', price: 6, es: 'Frutos rojos · Plátano · Avena · Yogur griego · Canela', en: 'Red berries · Banana · Oats · Greek yogurt · Cinnamon', tag: { es: 'Equilibrio y bienestar.', en: 'Balance and wellbeing.' } },
                { code: '06', name: '6AM in Kyoto', price: 7, es: 'Té matcha · Plátano · Yogur griego · Bebida de avena', en: 'Matcha tea · Banana · Greek yogurt · Oat drink', tag: { es: 'Energía sostenida y concentración.', en: 'Steady energy and focus.' } }
              ]
            },
            {
              title: { es: 'Zumos naturales', en: 'Fresh juices' }, alPending: true,
              items: [
                { code: '07', name: 'Depure', price: 5.5, es: 'Manzana verde · Pepino · Apio · Limón · Jengibre', en: 'Green apple · Cucumber · Celery · Lemon · Ginger', tag: { es: 'Ayuda a depurar el organismo.', en: 'Helps cleanse the body.' } },
                { code: '08', name: 'Vitality', price: 5.5, es: 'Naranja · Zanahoria · Manzana · Jengibre', en: 'Orange · Carrot · Apple · Ginger', tag: { es: 'Aporta vitaminas y combate el cansancio.', en: 'Vitamins to fight tiredness.' } },
                { code: '09', name: 'Anti-inflammatory', price: 6, es: 'Piña · Cúrcuma · Manzana · Limón · Jengibre', en: 'Pineapple · Turmeric · Apple · Lemon · Ginger', tag: { es: 'Contribuye a reducir la inflamación.', en: 'Helps reduce inflammation.' } },
                { code: '10', name: 'Immunity', price: 6, es: 'Naranja · Pomelo · Zanahoria · Jengibre', en: 'Orange · Grapefruit · Carrot · Ginger', tag: { es: 'Rico en vitamina C y fortalece las defensas.', en: 'Rich in vitamin C, boosts your defences.' } },
                { code: '11', name: 'Probiotic', price: 6, es: 'Piña · Manzana · Limón · Kéfir natural', en: 'Pineapple · Apple · Lemon · Natural kefir', tag: { es: 'Mejora la digestión y cuida la microbiota.', en: 'Improves digestion and cares for your gut.' } }
              ]
            }
          ]
        }
      ]
    },
    { id: 'bakery', color: 'red', soon: true, title: { es: 'Bakery', en: 'Bakery' }, desc: { es: 'Bollería, cookies, bizcochos y demás productos del horno.', en: 'Pastries, cookies, cakes and other baked goods.' }, groups: [] }
  ]
};

/* Las cinco cartas: Coffee & Matcha · Kitchen · Bakery · Fresh Drinks · Drinks & More.
   Se componen a partir de los bloques de arriba (el bloque "Drinks" se reparte entre Coffee & Matcha y Fresh Drinks). */
(function () {
  var C = window.CARTA, by = {};
  C.sections.forEach(function (s) { by[s.id] = s; });
  var drinks = by.bebidas.groups[0].blocks;
  function sheet(id, color, es, en, blocks) { return { id: id, color: color, title: { es: es, en: en }, groups: [{ title: { es: es, en: en }, blocks: blocks }] }; }
  C.sections = [
    sheet('coffee', 'olive', 'Coffee & Matcha', 'Coffee & Matcha', [drinks[0], drinks[1]]),
    by.kitchen,
    by.bakery,
    sheet('fresh', 'cream', 'Fresh Drinks', 'Fresh Drinks', [drinks[2], drinks[3]]),
    { id: 'more', color: 'dark', soon: true, title: { es: 'Drinks & More', en: 'Drinks & More' }, desc: { es: 'Aguas, refrescos, cervezas y otras bebidas.', en: 'Water, soft drinks, beers and other drinks.' }, groups: [] }
  ];
})();
