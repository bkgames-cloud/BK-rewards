-- Seed initial season (15 days from now)
INSERT INTO seasons (name, start_date, end_date, is_active)
VALUES ('Saison 1', NOW(), NOW() + INTERVAL '15 days', TRUE)
ON CONFLICT DO NOTHING;

-- Seed prizes with video goals
INSERT INTO prizes (name, description, image_url, video_goal, admin_email, display_order) VALUES
('iPhone', 'Le dernier iPhone avec des performances exceptionnelles', '/placeholder.svg?height=200&width=200', 500, 'admin-iphone@bkrewards.com', 1),
('Samsung', 'Smartphone Android haut de gamme', '/placeholder.svg?height=200&width=200', 500, 'admin-samsung@bkrewards.com', 2),
('PS5', 'Console de jeux PlayStation 5', '/placeholder.svg?height=200&width=200', 500, 'admin-ps5@bkrewards.com', 3),
('Xbox Series X', 'Console de jeux Microsoft', '/placeholder.svg?height=200&width=200', 500, 'admin-xbox@bkrewards.com', 4),
('AirPods Pro', 'Écouteurs sans fil Apple', '/placeholder.svg?height=200&width=200', 400, 'admin-airpods@bkrewards.com', 5),
('Nintendo Switch', 'Console portable hybride', '/placeholder.svg?height=200&width=200', 400, 'admin-switch@bkrewards.com', 6),
('Carte Cadeau 20€', 'Carte cadeau utilisable partout', '/placeholder.svg?height=200&width=200', 80, 'admin-gift20@bkrewards.com', 7),
('Carte Cadeau 10€', 'Carte cadeau utilisable partout', '/placeholder.svg?height=200&width=200', 50, 'admin-gift10@bkrewards.com', 8),
('Carte Cadeau 5€', 'Carte cadeau utilisable partout', '/placeholder.svg?height=200&width=200', 25, 'admin-gift5@bkrewards.com', 9)
ON CONFLICT DO NOTHING;

-- Seed cadeaux (nouveau système de wallet)
INSERT INTO cadeaux (nom, image_url, points_par_ticket, objectif_tickets, tickets_actuels, statut) VALUES
('iPhone', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80', 50, 500, 0, 'en_cours'),
('Samsung', 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80', 40, 500, 0, 'en_cours'),
('PlayStation 5', 'https://images.unsplash.com/photo-1606813909355-9c8de0d3f4d0?auto=format&fit=crop&w=900&q=80', 40, 500, 0, 'en_cours'),
('Xbox Series X', 'https://images.unsplash.com/photo-1605902711622-cfb43c44367f?auto=format&fit=crop&w=800&q=80', 40, 500, 0, 'en_cours'),
('AirPods Pro', 'https://images.unsplash.com/photo-1585386959984-a41552231692?auto=format&fit=crop&w=800&q=80', 30, 400, 0, 'en_cours'),
('Nintendo Switch', 'https://images.unsplash.com/photo-1523861751938-12159a93c9d2?auto=format&fit=crop&w=900&q=80', 30, 400, 0, 'en_cours'),
('Carte Amazon 20€', 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&w=900&q=80', 20, 80, 0, 'en_cours'),
('Carte Netflix 10€', 'https://images.unsplash.com/photo-1625225230517-7426c1be7505?auto=format&fit=crop&w=900&q=80', 10, 50, 0, 'en_cours'),
('Carte PSN 5€', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80', 5, 25, 0, 'en_cours')
ON CONFLICT DO NOTHING;
