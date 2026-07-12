import express, {
	urlencoded,
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import cors from "cors";
import { config } from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import errorHandler from "./middlewares/errorHandler.ts";
import { notFound } from "./middlewares/notFound.middleware.ts";
import router from "./routes/index.ts";
import logEvents from "./middlewares/logEvents.ts";

config();

const createApp = (): Application => {
	const app = express();

	app.use((req: Request, res: Response, next: NextFunction) => {
		logEvents(
			`${req.method} \t${req.headers.origin} \t${req.url}`,
			"reqLog.txt"
		);
		next();
	});
	app.use(helmet());
	app.use(
		cors({
			origin: process.env.CLIENT_ORIGIN,
			credentials: true,
		})
	);
	app.use(express.json());
	app.use(urlencoded({ extended: true }));
	app.use(cookieParser());

	if (process.env.NODE_ENV !== "development") {
		app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
	}

	app.use("/api/v1", router);
	app.use(notFound);
	app.use(errorHandler);
	return app;
};

export default createApp;
