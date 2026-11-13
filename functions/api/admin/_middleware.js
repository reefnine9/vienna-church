import {authenticated,configured,reply} from '../_lib/auth.js';
export async function onRequest({request,env,next}){if(!configured(env))return reply({error:'auth_not_configured'},503);if(!await authenticated(request,env))return reply({error:'unauthorized'},401);return next()}
