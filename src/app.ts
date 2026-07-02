import express, { urlencoded, type Application } from "express";
import cors from "cors";
import { config } from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import errorHandler from "./middlewares/errorHandler.ts";
import { notFound } from "./middlewares/motFound.ts";
import router from "./routes/index.ts";

config();

const createApp = (): Application => {
	const app = express();

	app.use(helmet());
	app.use(
		cors({
			origin: process.env.CLIENT_ORIGIN,
			credentials: true,
		}),
	);
	app.use(express.json());
	app.use(urlencoded({ extended: true }));

	if (process.env.NODE_ENV !== "development") {
		app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
	}

	app.use("/api/v1", router);
	app.use(notFound);
	app.use(errorHandler);
	return app;
};

export default createApp;
