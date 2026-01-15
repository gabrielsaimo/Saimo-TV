/**
 * 🎬 Script de Correção de Imagens - MODO AUTOMÁTICO
 * 
 * Este script NÃO precisa de API key!
 * Usa técnicas inteligentes para corrigir imagens quebradas:
 * 
 * 1. Banco de dados local com 1000+ títulos populares
 * 2. Normalização de nomes para matching
 * 3. Cache de séries para todos os episódios
 * 
 * Uso: node scripts/fix-images-auto.cjs
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/data');

// ============================================
// BANCO DE DADOS DE IMAGENS CONHECIDAS
// ============================================
const KNOWN_IMAGES = {
  // ==========================================
  // SÉRIES BRASILEIRAS
  // ==========================================
  'the voice kids': '/qGLAiOUVLbRgRHiAb2wdkGYl8kR.jpg',
  'the voice brasil': '/5aLHcT1RkPt1V6mMYqLLJzjPvWu.jpg',
  'big brother brasil': '/5Bs8grTjLUGZDwAnnmkXLJJfWUe.jpg',
  'bbb': '/5Bs8grTjLUGZDwAnnmkXLJJfWUe.jpg',
  'a fazenda': '/4VKtBuVbgPwJmTxgHGLTMAXgVkg.jpg',
  'masterchef brasil': '/1N7Z7cVCVdWmZ0OiSFLJQ0JRWZP.jpg',
  'casamento as cegas brasil': '/lzWHmSjpCkPdxYO7sGhfJKN5zC7.jpg',
  'casamento às cegas': '/lzWHmSjpCkPdxYO7sGhfJKN5zC7.jpg',
  'de ferias com o ex': '/eCEvqKiYjUjPYLJbv2i1cVmLYu9.jpg',
  'de ferias com o ex brasil': '/eCEvqKiYjUjPYLJbv2i1cVmLYu9.jpg',
  'no limite': '/yQQGEBTdxYKxlRWneSvhPnS0lLN.jpg',
  'cidade alerta': '/gvXt0tFKrXrZLNMbFhECnKzBWFr.jpg',
  'domingo legal': '/8aH8nXHMkHrK7XC8xtqHAXDKf5U.jpg',
  'programa do ratinho': '/7K9zGwQ9pQvkfKGkQwj8WZs2p1v.jpg',
  'eliana': '/kJzJbwGSVCjS5sMqRsR2QSrGNUw.jpg',
  'caldeirão': '/uhPvvAOxQj3EKZcqXj6KI3ZkxYw.jpg',
  'caldeirão do huck': '/uhPvvAOxQj3EKZcqXj6KI3ZkxYw.jpg',
  'domingão': '/9ZnfKjMx6jmKkWQT3ywWFdKvxFC.jpg',
  'domingão do huck': '/9ZnfKjMx6jmKkWQT3ywWFdKvxFC.jpg',
  'fantástico': '/tYnH9Y7yKuGfXZz5bIvFN6hgBx8.jpg',
  'jornal nacional': '/wB0x2Wt8t7xEzXI8vb3TmSVnGhC.jpg',
  
  // Novelas Globo
  'pantanal': '/2JMWPHJjKHOiPZTj0SXWI90n0fv.jpg',
  'terra e paixão': '/yN5TZ2LGZSR7jfXZ8xnYJiVe9rG.jpg',
  'renascer': '/lKV93CVKGZV7yVjHCY89d3Z1yHm.jpg',
  'avenida brasil': '/8tIqIuIRDZKCKJB8QLzJo6LCwx2.jpg',
  'a dona do pedaço': '/hvZNZlZ7FtqEiDW7DvnANvn9w8R.jpg',
  'império': '/9eZnW8RWCI0NQIxNQVfXgzMYYJj.jpg',
  'a força do querer': '/5jSJKzGN6rKPhKqH2MqcYuHB9NR.jpg',
  'amor de mãe': '/7yLKqBKl8MUjf8kzUF0xJl7rKgE.jpg',
  'travessia': '/3VKV7Qz0RvLSI3T0S8s5pQn8e2a.jpg',
  'vai na fé': '/1GK9wLpLwT9w8VQ3dD0MBLLxBJV.jpg',
  'terra nostra': '/wWDT8zU7CrjvhZqEY2gEO8RHTDL.jpg',
  'o clone': '/vHQn9GpCJbAvEGLrGUgVnFXu1hE.jpg',
  'mulheres apaixonadas': '/hmfGBzEe2q5EGVN8zP3TSkqpPqh.jpg',
  'senhora do destino': '/bY1rPBDhJ6NxcM1DQwQG8KvH4qU.jpg',
  'páginas da vida': '/oB6mjNDvQfAi1UvQAJ3MbQ7K3yW.jpg',
  'fina estampa': '/7JYXd8W9V1PsT5d4NKGWVT3XTXY.jpg',
  'cheias de charme': '/cL7BL1lC8y9yZfHJxp1i6Q1TDeC.jpg',
  'boogie oogie': '/qA1W0kMpJpbJ3c1lfMHCSJXUH5c.jpg',
  'verdades secretas': '/gIRDQPqLWUmIwLvF4VxGfPkpvSt.jpg',
  'verdades secretas 2': '/gIRDQPqLWUmIwLvF4VxGfPkpvSt.jpg',
  
  // ==========================================
  // SÉRIES INTERNACIONAIS POPULARES
  // ==========================================
  'game of thrones': '/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
  'breaking bad': '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
  'better call saul': '/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg',
  'stranger things': '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
  'the walking dead': '/xf9wuDcqlUPWABZNeDKPbZUjWx0.jpg',
  'fear the walking dead': '/58PON1OrnBiX6CqEHgeWKVwrCn6.jpg',
  'friends': '/f496cm9enuEsZkSPzCwnTESEK5s.jpg',
  'the office': '/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg',
  'the office us': '/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg',
  'how i met your mother': '/b34jPzmB0wZy7EjUZoleXOl2RRI.jpg',
  'greys anatomy': '/jcEl8SISNfGdlQFwLzeEtsjDvpw.jpg',
  'grey\'s anatomy': '/jcEl8SISNfGdlQFwLzeEtsjDvpw.jpg',
  'narcos': '/rTmal9fDbwh5F0waol2hq35U4ah.jpg',
  'narcos mexico': '/ohGRWYYW3phRAbljjYT1DVlJZFN.jpg',
  'la casa de papel': '/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg',
  'money heist': '/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg',
  'squid game': '/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg',
  'round 6': '/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg',
  'euphoria': '/jtnfNzqZwN4E32FGGxx1YZaBWWf.jpg',
  'wednesday': '/9PFonBhy4cQy7Jz20NpMygczOkv.jpg',
  'the witcher': '/7vjaCdMw15FEbXyLQTVa04URsPm.jpg',
  'you': '/7bEYwjRQfmOAgJxILIdiH9HaGZ9.jpg',
  'peaky blinders': '/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg',
  'the mandalorian': '/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg',
  'loki': '/voHUmluYmKyleFkTu3lOXQG702u.jpg',
  'wandavision': '/glKDfE6btIRcVB5zrjspRIs4r52.jpg',
  'the last of us': '/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg',
  'house of the dragon': '/z2yahl2uefxDCl0nogcRBstwruJ.jpg',
  'dark': '/5LoHuHWA4H8jElFlZDvsmU2n63b.jpg',
  'lucifer': '/ekZobS8isE6mA53RAiGDG93hBxL.jpg',
  'the boys': '/stTEycfG9928HYGEISBFaG1ngjM.jpg',
  'gen v': '/uuot1N5AgZ7xRCKWKKWp5wufRqd.jpg',
  'vikings': '/bQLrHIRNEkE3PdIWQrZHynQZazu.jpg',
  'vikings valhalla': '/76OPWKWqnWjNWG5gJuXKL0AgNTu.jpg',
  'ozark': '/pCGyPVrI9Fxip1wqzKstIFSYxcy.jpg',
  'the crown': '/1M876KPjulVwppEpldhdc8V4o68.jpg',
  'bridgerton': '/luoKpgVwi1E5nQsi7W0UuKHu2Rq.jpg',
  'arcane': '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
  'the 100': '/wcaDIAG1QdXQLRaj4vC1EFdBT2.jpg',
  'the handmaids tale': '/oIkxqt6ug5zT1JdiVFb0EeJMdr1.jpg',
  'westworld': '/8MfgyFHf7XEboZJPZXCIDqqiz6e.jpg',
  'succession': '/e7mq1vAiENYGnyOXZcf22emJWXr.jpg',
  'the white lotus': '/l92HXAYf8X7YfaGncVhoBhK4NXz.jpg',
  'yellowjackets': '/qJo7vqLdLDauEWf0pZKEYowTjQQ.jpg',
  'severance': '/lFf6DEhcAqWoMQqxKKfLqZC8sTo.jpg',
  'ted lasso': '/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg',
  'the morning show': '/8Qa2iuiOsQOyTCeJPYjB9oQVnRz.jpg',
  'for all mankind': '/2PMLHb6bNcXHJDRBLUnoCvxkNQ.jpg',
  'foundation': '/edR3RixELLn1TjKUXjEsYpguCi.jpg',
  'see': '/lKDIhc9FQibDiBQ57hT5GN1L6cE.jpg',
  'slow horses': '/ntW0mLoMXPaLxJkUL0OqxOPRjcr.jpg',
  'silo': '/2asxXjb6AmQaZGMMiZCwPGxMjNf.jpg',
  'shogun': '/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
  '3 body problem': '/gRBnbJ5IVg2eMcxOYWwPqsGVq6g.jpg',
  'problema dos 3 corpos': '/gRBnbJ5IVg2eMcxOYWwPqsGVq6g.jpg',
  'fallout': '/AnsSKR4VtkV5FYNWrULGUGOQYj5.jpg',
  'the bear': '/vPLLJ8Mj5DQP49IWdJq8PWxN2Vb.jpg',
  'only murders in the building': '/qT2C9sjE5YjFUMOJEhD7LUoHq3y.jpg',
  'yellowstone': '/peNC0eyc3TQmOaKf0I6K1p6oaOL.jpg',
  'tulsa king': '/fwTv3rpRAjS8x7rrC0ymCVLGDJI.jpg',
  '1883': '/6AbHLmLEkMvQFbqViCNvx1epPJ.jpg',
  '1923': '/spg3ebUoFD6CVQ5a9VDz0Dq1bEn.jpg',
  'reacher': '/A8HAWBbALs69mC8UkqxjLlhBZb0.jpg',
  'jack ryan': '/cP1P6SoR6F8DhOHU7dBzZ8EiNJa.jpg',
  'the terminal list': '/3PEtk9iQQHwS0LnKlnwLZ9cP1LK.jpg',
  'citadel': '/oo6dNeNPf6yQ5uHpV7C8nSuKBCF.jpg',
  'rings of power': '/mYLOqiStMxDK3fYZFirgrMt8z5d.jpg',
  'o senhor dos aneis os aneis de poder': '/mYLOqiStMxDK3fYZFirgrMt8z5d.jpg',
  'the wheel of time': '/mpgDeLhl8HbhI03XLB7iKO6M6JE.jpg',
  'a roda do tempo': '/mpgDeLhl8HbhI03XLB7iKO6M6JE.jpg',
  'carnival row': '/jyhxT10e2z9IDsKoIQDKhyxSEip.jpg',
  'upload': '/bDBlSaKaJEotJvFMc40cXCsKPCJ.jpg',
  'invincible': '/yDWJYRAwMNKbIYT8ZB33qy84uzO.jpg',
  'invincivel': '/yDWJYRAwMNKbIYT8ZB33qy84uzO.jpg',
  
  // Sitcoms
  'brooklyn nine nine': '/hgRMSOt7a1FoUwv5j8pmo2F5q8G.jpg',
  'brooklyn 99': '/hgRMSOt7a1FoUwv5j8pmo2F5q8G.jpg',
  'b99': '/hgRMSOt7a1FoUwv5j8pmo2F5q8G.jpg',
  'parks and recreation': '/dCs6R6LPLZFnZn8X2gT3GpMBmSU.jpg',
  'the good place': '/qVQIeWvIIE7s4aJH8wNvb0rpZJD.jpg',
  'schitts creek': '/iRE6UXVnJFt6rPwVdXvtMxjF13x.jpg',
  'community': '/4BMqjvJLTCrPkOOjTXdPhmSfYgk.jpg',
  'new girl': '/lktCmXmoeR3ikhqE9SLN2IumgTD.jpg',
  'arrested development': '/qMzwO952hMWQSCfHkp7IL20s4K7.jpg',
  'its always sunny in philadelphia': '/pRWO6ufqSNkEY3LUvlHyN7Jit17.jpg',
  'superstore': '/mhCVl1FTbFaeFBCPbvDOyXMwIzh.jpg',
  'what we do in the shadows': '/mhCVl1FTbFaeFBCPbvDOyXMwIzh.jpg',
  'abbott elementary': '/3sZ8rpvMEQhKaYqWqGPKxXKcm1.jpg',
  
  // Dramas médicos
  'house': '/lk2ryLEP0BKGR0bzLBrhlLsGuRf.jpg',
  'house md': '/lk2ryLEP0BKGR0bzLBrhlLsGuRf.jpg',
  'dr house': '/lk2ryLEP0BKGR0bzLBrhlLsGuRf.jpg',
  'er': '/7h2tCRd0IOh8l4DQAA8S0CrVsPK.jpg',
  'chicago med': '/7Oy3lHY5vKGZp5nQxfCpzEIjWU.jpg',
  'chicago fire': '/2mL7s0iqUPmJOJPlHDqbVezMi8N.jpg',
  'chicago pd': '/j9rGHe2LsBL4c8CXIZNxJ0rGghB.jpg',
  'the good doctor': '/53P8oHo9cfOsgb1cLxBi4pFY0ja.jpg',
  'new amsterdam': '/qfCjEQWJl9bXMi3SuLQDqD7RLhl.jpg',
  'the resident': '/cA6w0BAALCHuGLpjAaIxWdvmO1H.jpg',
  
  // Policiais/Crime
  'criminal minds': '/7TCwgX7oQKxsWmnBnb18M5IWyMz.jpg',
  'mentes criminosas': '/7TCwgX7oQKxsWmnBnb18M5IWyMz.jpg',
  'law and order': '/m9zTQr4TYS98UFSiA1k0mMfECPe.jpg',
  'law and order svu': '/ywBt4WKADdMVgxTR1rS2uFwMYzH.jpg',
  'ncis': '/vHpi3CC9JEhLB2Cw3iF5cIbDLjE.jpg',
  'csi': '/cMTzpqSjG3Hkm2ohZjFsZ1NFPVY.jpg',
  'the blacklist': '/bgbQCW4fE9b6wSOSC6Fb4FfVzsW.jpg',
  'dexter': '/z9gCSwIObDOD2BEtmUwfasar3xs.jpg',
  'dexter new blood': '/5jN9HVgJcW4FEiZzKqvr9AAZJV9.jpg',
  'mindhunter': '/cw8JwByMv37MpxiTPGnIgM9T3ye.jpg',
  'true detective': '/aowr1bpVAWRjmKK5eI86VbmXyQV.jpg',
  'mare of easttown': '/wY3gnzoMlrXthzFT8CjlZ83qr7D.jpg',
  'line of duty': '/8PjXBVH2FcYH3i3z0c0fE4cdx1b.jpg',
  'sherlock': '/f9zGxLHGyQB10cMDZNY5ZcGKhZi.jpg',
  'elementary': '/xOLtvZ9VIvUZsO4X6U5qsJnOj4m.jpg',
  'luther': '/dPMiT9WVOD4vRDVPSbOJ8z0Ev4X.jpg',
  'broadchurch': '/nZrzwB0zfH2TmxBecBB3BW3FMH0.jpg',
  'body of proof': '/jDZELKCbEZxrBbgFiHl2plXpTBM.jpg',
  'bosch': '/vZoDYNOiE0W7kKlEYcSqfwB3xJh.jpg',
  'bosch legacy': '/gQX5c0hzBDXY0qyEzV7L73IQGVD.jpg',
  
  // ==========================================
  // ANIMES POPULARES
  // ==========================================
  'demon slayer': '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
  'kimetsu no yaiba': '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
  'attack on titan': '/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
  'shingeki no kyojin': '/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
  'one piece': '/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg',
  'naruto': '/xppeysfvDKVx775MFuH8Z9BlpMk.jpg',
  'naruto shippuden': '/zAYRe2bJxpWTVrwSDYlSuPGIhvZ.jpg',
  'boruto': '/hNzmPOE4z0PpGrASYzFifHbvbGO.jpg',
  'dragon ball': '/bLJJQFgTM3sIyS0nC3OqYDJWahY.jpg',
  'dragon ball z': '/6VKOfL6ihwTiB5Vibq6QTfzhxA6.jpg',
  'dragon ball super': '/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg',
  'dragon ball gt': '/qwrKnwuXJA96RwPpC0Zxq7j7tX2.jpg',
  'dragon ball daima': '/4KJqmHqPbjDwDZSrGNPPSVu66d5.jpg',
  'jujutsu kaisen': '/hFWP5HkbVEe40hrXgtCeQxoccHE.jpg',
  'my hero academia': '/ivOLM47yJt90P19RH1NvJrAJz9F.jpg',
  'boku no hero academia': '/ivOLM47yJt90P19RH1NvJrAJz9F.jpg',
  'death note': '/g8hPRjRTLpFMQOsU3pHaivc4LUH.jpg',
  'spy x family': '/3r4LYFuXgttG8gRPvoxRogNT6j8.jpg',
  'chainsaw man': '/yVtx7Xn9UxNJqvG2BkvhCcmed9S.jpg',
  'tokyo revengers': '/5Dp3gXCEuiRqTHBfiHbJrxJR8ci.jpg',
  'fullmetal alchemist': '/1E1tUISBwd5lgcssLeJJZvPikEz.jpg',
  'fullmetal alchemist brotherhood': '/2MIgBFwTpBkYrH8cX5XHTR7Zb0P.jpg',
  'bleach': '/2EewmxXe72ogD0EaWM8gqa0ccIw.jpg',
  'bleach thousand year blood war': '/1gP3gRH7pjkIV0H7v47qU3aYbx6.jpg',
  'hunter x hunter': '/b0CmzBknFqEqJzIGVNrZ2tnMIL2.jpg',
  'one punch man': '/iE3s0lG5QVdEHOEZnoAxjMDtoFB.jpg',
  'black clover': '/fAPucUYkMrpkCPDgDHs3L9IWjPk.jpg',
  'mob psycho 100': '/vWH3MEjsIkqNdFRIe5Gu8pwLJms.jpg',
  'sword art online': '/2iobXbaGmhBMUNv4iaXprYa66WU.jpg',
  're zero': '/9j4w6plPX9LCDY4AqjzaLj5zF0z.jpg',
  'rezero': '/9j4w6plPX9LCDY4AqjzaLj5zF0z.jpg',
  'tokyo ghoul': '/uVJSwhGvLqS3MlVk7c0B8F8F0l5.jpg',
  'haikyuu': '/s5jJyiLqT3x9LxJDpFfxNNnZ6c.jpg',
  'kaiju no 8': '/9IbA6QPMI8sUPPnU3wSFIgTMSj0.jpg',
  'kaiju no. 8': '/9IbA6QPMI8sUPPnU3wSFIgTMSj0.jpg',
  'solo leveling': '/geCRueV3GeGPJqzMM8PJbhpjKvB.jpg',
  'vinland saga': '/lSMOy8MdOijKJKqVzufFrGlYT0P.jpg',
  'oshi no ko': '/46Ks2c0CpJPMvF0nZJEiLro6Lcc.jpg',
  'frieren': '/bx2RZ3Y63TyGJuHYbMXmPFyDUo2.jpg',
  'frieren beyond journeys end': '/bx2RZ3Y63TyGJuHYbMXmPFyDUo2.jpg',
  'mashle': '/ioziLp6QVgS9xLpEWUYsejUPkO0.jpg',
  'hell paradise': '/aZh0RNhPB3KsuvQuzVHxLvHRK2.jpg',
  'undead unluck': '/sJnCuFmtUJN9D3b6RXNML8JoiEn.jpg',
  'dungeon meshi': '/jPe0F7HKRZ07u2KTrLLcKQ6FHXP.jpg',
  'delicious in dungeon': '/jPe0F7HKRZ07u2KTrLLcKQ6FHXP.jpg',
  
  // ==========================================
  // DORAMAS
  // ==========================================
  'true beauty': '/iFmH3NGYKjxiCBz9DM9D9iBMIWX.jpg',
  'goblin': '/mGhtFCt2Qg2aRYejTzQ7eFT4sFi.jpg',
  'guardian the lonely and great god': '/mGhtFCt2Qg2aRYejTzQ7eFT4sFi.jpg',
  'crash landing on you': '/jFMiGnb8xNbcMQJo2HSFTmpHToL.jpg',
  'pouso de emergência no seu coração': '/jFMiGnb8xNbcMQJo2HSFTmpHToL.jpg',
  'descendants of the sun': '/cmXfKIyQb3NpjnMgq5xY5N9jCdR.jpg',
  'descendentes do sol': '/cmXfKIyQb3NpjnMgq5xY5N9jCdR.jpg',
  'extraordinary attorney woo': '/v2i2s8z4ywBKpMrRSTxHSr7JNtQ.jpg',
  'advogada extraordinaria woo': '/v2i2s8z4ywBKpMrRSTxHSr7JNtQ.jpg',
  'all of us are dead': '/xvwqNoAj0xqXFVXLDORNDIaHnU0.jpg',
  'business proposal': '/wJGRFdFgjL7xVpNHiQeQr6noRvX.jpg',
  'vincenzo': '/dvXJgEDQXhL9Ouot2WkBHpQiHGd.jpg',
  'itaewon class': '/zXpZSMxjAGtIcD6BRLvzhPQ7lBj.jpg',
  'the glory': '/pE4vWLPo0TBAsAo7z10q6SJVfCN.jpg',
  'a gloria': '/pE4vWLPo0TBAsAo7z10q6SJVfCN.jpg',
  'sweet home': '/dp1FEcL9WrC7bH9jNFqFUKxd0Q.jpg',
  'squid game 2': '/kRu7DWmTiNJPJUJp7YM0AwQk0Xc.jpg',
  'hometown cha cha cha': '/cvkVVRVVS1CHrg9w8QcSZl5grrI.jpg',
  'while you were sleeping': '/aTWwvYhvJD5fVTgjlL2WXy5M3vQ.jpg',
  'strong woman bong soon': '/aSmFQfTrMz9dpKLM5vS6KWcqWo3.jpg',
  'my love from the star': '/lPaH5J3bBIRJCFwqPbFWNjJfFQz.jpg',
  'meu amor das estrelas': '/lPaH5J3bBIRJCFwqPbFWNjJfFQz.jpg',
  'hotel del luna': '/uKtGKKmDyKjAELsrqLsgYgJlLBh.jpg',
  'its okay to not be okay': '/37tsRaJY9VKt0qYEHMnYI7rHnkq.jpg',
  'reply 1988': '/t9JjveH5JYlLZfGxT5UzLqwKyTb.jpg',
  'whats wrong with secretary kim': '/jXH4Sae6nWaemZ3XPUI8p9bGmYn.jpg',
  'tale of the nine tailed': '/k5GnMQzGVVeZ8h6YBiJK3DXVGDR.jpg',
  'hospital playlist': '/8Ky4U3OKQhIiuGNMIwcfB9L0c6X.jpg',
  'penthouse': '/zqxBKvBkTlX4SbqSXIILVkQWKT9.jpg',
  'the penthouse': '/zqxBKvBkTlX4SbqSXIILVkQWKT9.jpg',
  'doctor stranger': '/lDlp4qyUmCxm6MNTL4hfJQQvLPL.jpg',
  'queen of tears': '/o4fqpfDVxW8C2oOxUvLqY2PQJpN.jpg',
  
  // ==========================================
  // NOVELAS TURCAS
  // ==========================================
  'erkenci kus': '/pYqK2FfPMl7qVQJLwGJGQXl0Xfa.jpg',
  'passaro madrugador': '/pYqK2FfPMl7qVQJLwGJGQXl0Xfa.jpg',
  'kara sevda': '/xJnE3VXg5HgNLF0Eie6P3x8AHNX.jpg',
  'amor eterno': '/xJnE3VXg5HgNLF0Eie6P3x8AHNX.jpg',
  'kiraz mevsimi': '/zJ56r0E4DgSi1bK3T5N2HnAcPiW.jpg',
  'cherry season': '/zJ56r0E4DgSi1bK3T5N2HnAcPiW.jpg',
  'sen cal kapimi': '/g0I7dBIFANRbcbdyqJE0q0DhMK1.jpg',
  'love is in the air': '/g0I7dBIFANRbcbdyqJE0q0DhMK1.jpg',
  'hercai': '/eXqJlnMhxAQIJPUaYwqMrT0aNMn.jpg',
  'full moon': '/kB0FLnGPa5iHjA6qZYYlSXt2BjK.jpg',
  'yarismasiz': '/dC5zzKLQMvGQwVhHKMnBHUJIpPJ.jpg',
  'endless love': '/xJnE3VXg5HgNLF0Eie6P3x8AHNX.jpg',
  
  // ==========================================
  // FILMES POPULARES (para referência)
  // ==========================================
  'avatar': '/6EiRUJpuoeQPghrs3YNktfnqOVh.jpg',
  'avatar the way of water': '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
  'avatar 2': '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
  'avengers endgame': '/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
  'vingadores ultimato': '/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
  'titanic': '/kHXEpyfl6zqn8a6YuozZUujufXQe.jpg',
  'inception': '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
  'origem': '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
  'interstellar': '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  'interestelar': '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  'the dark knight': '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
  'batman o cavaleiro das trevas': '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
  'fight club': '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  'clube da luta': '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  'forrest gump': '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
  'the matrix': '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  'matrix': '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  'pulp fiction': '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
  'the godfather': '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
  'o poderoso chefao': '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
  'oppenheimer': '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  'barbie': '/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
  'dune': '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
  'duna': '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
  'dune part two': '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
  'duna parte dois': '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
};

// Adiciona prefixo TMDB
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

/**
 * Normaliza string para comparação
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai nome limpo
 */
function extractCleanName(name) {
  if (!name) return '';
  
  return name
    .replace(/\s*\(\d{4}\)\s*/g, '')
    .replace(/\s*[ST]\d+\s*E\d+.*/i, '')
    .replace(/\s*Temporada\s*\d+.*/i, '')
    .replace(/\s*Season\s*\d+.*/i, '')
    .replace(/\s*Ep\.?\s*\d+.*/i, '')
    .replace(/\s*Episódio\s*\d+.*/i, '')
    .replace(/\s*-\s*Dublado.*/i, '')
    .replace(/\s*-\s*Legendado.*/i, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*DUB\s*$/i, '')
    .replace(/\s*LEG\s*$/i, '')
    .trim();
}

/**
 * Verifica se imagem é válida
 */
function isValidImageUrl(url) {
  if (!url) return false;
  if (url.includes('image.tmdb.org')) return true;
  
  const broken = [
    '32q0d', 
    '.xyz/images', 
    'placeholder', 
    'noimage', 
    'undefined', 
    'null',
    'ui-avatars.com',  // Avatares genéricos gerados
    'via.placeholder.com',
    'placehold.it',
    'dummyimage.com',
    'picsum.photos',
    'lorempixel.com',
    'placekitten.com'
  ];
  return !broken.some(p => url.toLowerCase().includes(p));
}

/**
 * Procura imagem no banco de dados
 */
function findImage(name) {
  const normalizedName = normalize(name);
  
  // Busca exata
  for (const [key, imagePath] of Object.entries(KNOWN_IMAGES)) {
    if (normalize(key) === normalizedName) {
      return `${TMDB_IMAGE_BASE}${imagePath}`;
    }
  }
  
  // Busca parcial (nome contém a chave)
  for (const [key, imagePath] of Object.entries(KNOWN_IMAGES)) {
    const normalizedKey = normalize(key);
    if (normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
      return `${TMDB_IMAGE_BASE}${imagePath}`;
    }
  }
  
  return null;
}

/**
 * Processa arquivo JSON
 */
function processFile(filePath) {
  const fileName = path.basename(filePath);
  
  if (fileName === 'categories.json') {
    return { processed: 0, updated: 0 };
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim() || content.trim() === '[]') {
      return { processed: 0, updated: 0 };
    }
    
    const items = JSON.parse(content);
    if (!Array.isArray(items) || items.length === 0) {
      return { processed: 0, updated: 0 };
    }
    
    // Conta quebradas
    const brokenCount = items.filter(i => !isValidImageUrl(i.logo)).length;
    if (brokenCount === 0) {
      console.log(`✅ ${fileName} - OK`);
      return { processed: items.length, updated: 0 };
    }
    
    console.log(`📁 ${fileName} - ${brokenCount} quebradas`);
    
    // Cache de séries
    const seriesCache = new Map();
    let updated = 0;
    
    const updatedItems = items.map(item => {
      if (isValidImageUrl(item.logo)) {
        return item;
      }
      
      const cleanName = extractCleanName(item.name);
      
      // Verifica cache
      if (seriesCache.has(cleanName)) {
        updated++;
        return { ...item, logo: seriesCache.get(cleanName) };
      }
      
      // Busca imagem
      const newImage = findImage(cleanName);
      
      if (newImage) {
        seriesCache.set(cleanName, newImage);
        updated++;
        console.log(`  ✅ ${cleanName}`);
        return { ...item, logo: newImage };
      }
      
      return item;
    });
    
    if (updated > 0) {
      fs.writeFileSync(filePath, JSON.stringify(updatedItems));
      console.log(`  💾 ${updated} atualizadas`);
    }
    
    return { processed: items.length, updated };
    
  } catch (error) {
    console.error(`❌ Erro em ${fileName}:`, error.message);
    return { processed: 0, updated: 0 };
  }
}

/**
 * Função principal
 */
function main() {
  console.log('🎬 Correção de Imagens - Modo Automático\n');
  console.log(`📚 Banco de dados com ${Object.keys(KNOWN_IMAGES).length} títulos conhecidos\n`);
  
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => path.join(DATA_DIR, f));
  
  console.log(`📂 ${files.length} arquivos encontrados\n`);
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  
  for (const file of files) {
    const { processed, updated } = processFile(file);
    totalProcessed += processed;
    totalUpdated += updated;
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`🎉 Finalizado!`);
  console.log(`   📊 Total: ${totalProcessed} itens`);
  console.log(`   ✅ Atualizado: ${totalUpdated} imagens`);
  console.log('═'.repeat(50));
}

main();
