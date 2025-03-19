import { Request, Response, NextFunction } from 'express';

export const apiKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
	const apiKey = req.headers['x-api-key'];
	const expectedApiKey = process.env.API_KEY;
	if (!expectedApiKey || apiKey !== expectedApiKey) {
		return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
	}
	next();
};
