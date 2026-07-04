import {  RedisClient } from "bun";

export const client = new RedisClient("redis://localhost:6379");

await client.connect();