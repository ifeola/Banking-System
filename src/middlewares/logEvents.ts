import { v4 as uuid } from "uuid";
import { format } from "date-fns";
import fs from "fs";
import path from "path";
import fsPromises from "fs/promises";

const __dirname = path.dirname(import.meta.dirname);

const logEvents = async (message: string, logName: string) => {
	const dateTime = `${format(new Date(), "yyyyMMdd\tHH:mm:ss")}`;
	const logItem = `${dateTime}\t ${uuid()} \t ${message} \n`;

	try {
		if (!fs.existsSync(path.join(__dirname, "logs"))) {
			await fsPromises.mkdir(path.join(__dirname, "logs"));
		}

		fsPromises.appendFile(path.join(__dirname, "logs", logName), logItem);
	} catch (error) {
		console.log(error);
	}
};

export default logEvents;
