import { Router } from "express";

const services = [
  // Диагностика
  "Компьютерная диагностика",
  "Диагностика ЭЛ. оборудования",
  "Диагностика ЭЛ. проводки",
  "Диагностика впускного тракта",
  "Диагностика выпускного тракта",
  // Ремонт
  "Ремонт трапеции",
  "Ремонт фар",
  "Ремонт кондиционера",
  "Ремонт зажигания",
  "Ремонт щитка приборов",
  "Ремонт печки",
  "Ремонт стеклоподъемника",
  "Ремонт замка",
  // Замена
  "Замена свечей",
  "Замена форсунок",
  "Замена катушек",
  "Замена моторчика",
  "Замена трапеции",
  "Замена фар",
  "Замена ремня",
  "Замена вентилятора",
  "Замена радиатора",
  "Замена стеклоподъемника",
  "Замена щитка приборов",
  "Замена замка",
  // Установка
  "Установка магнитолы",
  "Установка камеры з/в",
];

export const servicesRouter = Router();

servicesRouter.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const query = (req.query.q as string | undefined)?.trim().toLowerCase();
  if (!query) {
    return res.json(services);
  }
  const filtered = services.filter((name) => name.toLowerCase().includes(query)).slice(0, 20);
  return res.json(filtered);
});
