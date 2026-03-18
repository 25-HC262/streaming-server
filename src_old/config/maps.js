

/*
export const userIdToSubscribers = new Map();
export const senderToPublishingUserIds = new Map(); 
export const userIdToMimeType = new Map(); 
export const userIdToStream = new Map();

export const addSubscriber = (userId, subscriber) => {
    if (!userIdToSubscribers.has(userId)) {
        userIdToSubscribers.set(userId, []);
    }
    userIdToSubscribers.get(userId).push(subscriber);
};

export const removeSubscriber = (userId, subscriber) => {
    const subscribers = userIdToSubscribers.get(userId);
    if (subscribers) {
        const index = subscribers.indexOf(subscriber);
        if (index > -1) {
            subscribers.splice(index, 1);
        }
    }
};

export const getSubscribers = (userId) => {
    return userIdToSubscribers.get(userId) || [];
};
*/

export const userIdToSubscribers = new Map();
export const userIdToMimeType = new Map(); 
export const userIdToStream = new Map(); 

/*
module.exports = {
  userIdToSubscribers,
  userIdToMimeType,
  userIdToStream
};
*/