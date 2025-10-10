-- Associar filmes às suas categorias
-- Superman: Ação, Ficção Científica, Aventura
INSERT INTO content_categories (content_id, category_id) VALUES
('7ef17049-402d-49d5-bf7d-12811f2f4c45', '7b8a49aa-3da5-4e0e-9dca-5db9b4549852'), -- Ação
('7ef17049-402d-49d5-bf7d-12811f2f4c45', '253c67ec-2e3f-4bda-bc18-3dbb7ea3f739'), -- Ficção Científica
('7ef17049-402d-49d5-bf7d-12811f2f4c45', '042ed4a7-5833-4a4d-8249-833f10139357'); -- Aventura

-- Como Treinar o Seu Dragão: Aventura, Animação
INSERT INTO content_categories (content_id, category_id) VALUES
('ec38b056-0b6e-48d8-9d94-b5081e0b7855', '042ed4a7-5833-4a4d-8249-833f10139357'), -- Aventura
('ec38b056-0b6e-48d8-9d94-b5081e0b7855', '1dbb0cd5-23af-4502-a968-03e699e5c02a'); -- Animação

-- F1 - O Filme: Drama, Ação
INSERT INTO content_categories (content_id, category_id) VALUES
('0b2dfa6d-782d-4982-83d3-490fea4bfc5b', '010c9ad1-25f9-4b0f-bbec-ffeaa99be8fa'), -- Drama
('0b2dfa6d-782d-4982-83d3-490fea4bfc5b', '7b8a49aa-3da5-4e0e-9dca-5db9b4549852'); -- Ação

-- A Hora do Mal: Suspense, Terror
INSERT INTO content_categories (content_id, category_id) VALUES
('da5a57f3-a4d8-41d7-bffd-3f46042b55ea', '09e20f1c-dbc4-4dba-8885-2c326cad9bcf'), -- Suspense
('da5a57f3-a4d8-41d7-bffd-3f46042b55ea', '6942efb8-3682-4453-91a4-2f82e4c50433'); -- Terror

-- Quarteto Fantástico 4: Ação, Ficção Científica, Aventura
INSERT INTO content_categories (content_id, category_id) VALUES
('f1465fe2-8b04-4522-8c97-56b725270312', '7b8a49aa-3da5-4e0e-9dca-5db9b4549852'), -- Ação
('f1465fe2-8b04-4522-8c97-56b725270312', '253c67ec-2e3f-4bda-bc18-3dbb7ea3f739'), -- Ficção Científica
('f1465fe2-8b04-4522-8c97-56b725270312', '042ed4a7-5833-4a4d-8249-833f10139357'); -- Aventura

-- Invocação do Mal 4: Terror, Suspense
INSERT INTO content_categories (content_id, category_id) VALUES
('cea7478d-abcd-4039-bb1b-b15839da4cfe', '6942efb8-3682-4453-91a4-2f82e4c50433'), -- Terror
('cea7478d-abcd-4039-bb1b-b15839da4cfe', '09e20f1c-dbc4-4dba-8885-2c326cad9bcf'); -- Suspense

-- Demon Slayer: Ação, Aventura, Animação
INSERT INTO content_categories (content_id, category_id) VALUES
('42a1ec67-6136-4855-87ee-e1fb676e1370', '7b8a49aa-3da5-4e0e-9dca-5db9b4549852'), -- Ação
('42a1ec67-6136-4855-87ee-e1fb676e1370', '042ed4a7-5833-4a4d-8249-833f10139357'), -- Aventura
('42a1ec67-6136-4855-87ee-e1fb676e1370', '1dbb0cd5-23af-4502-a968-03e699e5c02a'); -- Animação

-- A Longa Marcha: Terror, Suspense, Drama
INSERT INTO content_categories (content_id, category_id) VALUES
('560796b5-f5dd-4b02-a769-0f4f5df22892', '6942efb8-3682-4453-91a4-2f82e4c50433'), -- Terror
('560796b5-f5dd-4b02-a769-0f4f5df22892', '09e20f1c-dbc4-4dba-8885-2c326cad9bcf'), -- Suspense
('560796b5-f5dd-4b02-a769-0f4f5df22892', '010c9ad1-25f9-4b0f-bbec-ffeaa99be8fa'); -- Drama

-- Jurassic World: Aventura, Ação, Ficção Científica
INSERT INTO content_categories (content_id, category_id) VALUES
('22311a9e-8aac-4fad-b62c-175468296bf6', '042ed4a7-5833-4a4d-8249-833f10139357'), -- Aventura
('22311a9e-8aac-4fad-b62c-175468296bf6', '7b8a49aa-3da5-4e0e-9dca-5db9b4549852'), -- Ação
('22311a9e-8aac-4fad-b62c-175468296bf6', '253c67ec-2e3f-4bda-bc18-3dbb7ea3f739'); -- Ficção Científica

-- Lilo & Stitch: Comédia, Aventura, Animação
INSERT INTO content_categories (content_id, category_id) VALUES
('c7ed9623-7bcb-4c13-91b7-6f96b76facd1', '314477dd-8e64-4f60-b796-ceb2eea73d87'), -- Comédia
('c7ed9623-7bcb-4c13-91b7-6f96b76facd1', '042ed4a7-5833-4a4d-8249-833f10139357'), -- Aventura
('c7ed9623-7bcb-4c13-91b7-6f96b76facd1', '1dbb0cd5-23af-4502-a968-03e699e5c02a'); -- Animação
