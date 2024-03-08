import type { EventHandlerRequest, H3Event } from 'h3';
import { UAParser } from 'ua-parser-js';
import { getHeader } from '#imports';
import { lucia } from './auth';

type SessionInfo = {
  userId: number;
  username: string;
  publicId: string;
};

export const createLuciaSessionCookie = async (
  event: H3Event<EventHandlerRequest>,
  info: SessionInfo
) => {
  const { device, os } = UAParser(getHeader(event, 'User-Agent'));
  const userDevice =
    device.type === 'mobile' ? device.toString() : device.vendor;
  const { userId, username, publicId } = info;
  const userSession = await lucia.createSession(publicId, {
    user: {
      id: userId,
      username,
      publicId
    },
    device: userDevice || 'Unknown',
    os: os.name || 'Unknown'
  });
  const cookie = lucia.createSessionCookie(userSession.id);
  return cookie;
};