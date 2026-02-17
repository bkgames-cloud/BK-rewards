-- Update cadeaux pricing and names to match new participation tariffs
UPDATE cadeaux
SET points_par_ticket = 50,
    nom = 'iPhone',
    image_url = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80'
WHERE nom ILIKE '%iphone%';

UPDATE cadeaux
SET points_par_ticket = 40,
    nom = 'PlayStation 5',
    image_url = 'https://images.unsplash.com/photo-1606813909355-9c8de0d3f4d0?auto=format&fit=crop&w=900&q=80'
WHERE nom ILIKE '%playstation%' OR nom ILIKE '%ps5%';

UPDATE cadeaux
SET points_par_ticket = 40,
    nom = 'Samsung',
    image_url = 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80'
WHERE nom ILIKE '%samsung%';

UPDATE cadeaux
SET points_par_ticket = 30,
    image_url = 'https://images.unsplash.com/photo-1523861751938-12159a93c9d2?auto=format&fit=crop&w=900&q=80'
WHERE nom ILIKE '%nintendo switch%';

UPDATE cadeaux
SET nom = 'Carte Amazon 20€',
    points_par_ticket = 20,
    image_url = 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&w=900&q=80'
WHERE nom ILIKE 'Carte Cadeau 20€' OR nom ILIKE '%amazon 20%';

UPDATE cadeaux
SET nom = 'Carte Google Play 10€',
    points_par_ticket = 10,
    image_url = 'https://images.unsplash.com/photo-1625225230517-7426c1be7505?auto=format&fit=crop&w=900&q=80'
WHERE nom ILIKE 'Carte Cadeau 10€' OR nom ILIKE '%google 10%' OR nom ILIKE '%netflix%';

UPDATE cadeaux
SET nom = 'Carte PSN 5€',
    points_par_ticket = 5,
    image_url = 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80'
WHERE nom ILIKE 'Carte Cadeau 5€' OR nom ILIKE '%psn 5%';
