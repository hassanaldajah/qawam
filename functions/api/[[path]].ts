import { error } from "../_lib/http";

/** Default deny: any /api route or method without a handler is a JSON 404. */
export const onRequest = async (): Promise<Response> => error(404, "not_found");
