import { useAction, useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import "./index.css";

type MessageType = { type: "success" | "error"; text: string } | null;

export function App() {
	// API Key state - stored in localStorage for convenience
	const [apiKey, setApiKey] = useState(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("loops_api_key") || "";
		}
		return "";
	});
	const [showApiKey, setShowApiKey] = useState(false);

	// Contact form state
	const [email, setEmail] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [userGroup, setUserGroup] = useState("");
	const [source, setSource] = useState("");

	// Event form state
	const [eventName, setEventName] = useState("welcome");

	// Transactional form state
	const [transactionalId, setTransactionalId] = useState("");

	// UI state
	const [message, setMessage] = useState<MessageType>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<
		"contacts" | "events" | "stats" | "rate-limits"
	>("contacts");

	// Actions
	const addContactAction = useAction(api.example.addContact);
	const findContactAction = useAction(api.example.findContact);
	const deleteContactAction = useAction(api.example.deleteContact);
	const sendEventAction = useAction(api.example.sendEvent);
	const sendTransactionalAction = useAction(api.example.sendTransactional);
	const unsubscribeAction = useAction(api.example.unsubscribeContact);
	const resubscribeAction = useAction(api.example.resubscribeContact);

	// Queries (no API key needed - local database)
	const contactCount = useQuery(api.example.countContacts, {});
	const emailStats = useQuery(api.example.getEmailStats, {
		timeWindowMs: 86400000,
	});
	const recipientSpam = useQuery(api.example.detectRecipientSpam, {});

	// Save API key to localStorage
	const handleSaveApiKey = () => {
		localStorage.setItem("loops_api_key", apiKey);
		setMessage({ type: "success", text: "API key saved to browser storage" });
	};

	const handleClearApiKey = () => {
		setApiKey("");
		localStorage.removeItem("loops_api_key");
		setMessage({ type: "success", text: "API key cleared" });
	};

	// Contact operations
	const handleAddContact = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!apiKey) {
			setMessage({ type: "error", text: "Please enter your Loops API key" });
			return;
		}
		setIsLoading(true);
		setMessage(null);

		try {
			await addContactAction({
				apiKey,
				email,
				firstName: firstName || undefined,
				lastName: lastName || undefined,
				userGroup: userGroup || undefined,
				source: source || undefined,
			});
			setMessage({ type: "success", text: "Contact added successfully!" });
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "Failed to add contact",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleFindContact = async () => {
		if (!apiKey || !email) {
			setMessage({
				type: "error",
				text: "Please enter API key and email",
			});
			return;
		}
		setIsLoading(true);
		setMessage(null);

		try {
			const result = await findContactAction({ apiKey, email });
			if (result.success && result.contact) {
				setMessage({
					type: "success",
					text: `Found: ${result.contact.email} (${result.contact.firstName || "No name"})`,
				});
			} else {
				setMessage({ type: "error", text: "Contact not found" });
			}
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "Failed to find contact",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteContact = async () => {
		if (!apiKey || !email) {
			setMessage({
				type: "error",
				text: "Please enter API key and email",
			});
			return;
		}
		if (!confirm(`Delete contact ${email}?`)) return;

		setIsLoading(true);
		setMessage(null);

		try {
			await deleteContactAction({ apiKey, email });
			setMessage({ type: "success", text: "Contact deleted successfully!" });
			setEmail("");
			setFirstName("");
			setLastName("");
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof Error ? error.message : "Failed to delete contact",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleUnsubscribe = async () => {
		if (!apiKey || !email) {
			setMessage({
				type: "error",
				text: "Please enter API key and email",
			});
			return;
		}
		setIsLoading(true);
		setMessage(null);

		try {
			await unsubscribeAction({ apiKey, email });
			setMessage({ type: "success", text: "Contact unsubscribed!" });
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof Error
						? error.message
						: "Failed to unsubscribe contact",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleResubscribe = async () => {
		if (!apiKey || !email) {
			setMessage({
				type: "error",
				text: "Please enter API key and email",
			});
			return;
		}
		setIsLoading(true);
		setMessage(null);

		try {
			await resubscribeAction({ apiKey, email });
			setMessage({ type: "success", text: "Contact resubscribed!" });
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof Error
						? error.message
						: "Failed to resubscribe contact",
			});
		} finally {
			setIsLoading(false);
		}
	};

	// Event operations
	const handleSendEvent = async () => {
		if (!apiKey || !email || !eventName) {
			setMessage({
				type: "error",
				text: "Please enter API key, email, and event name",
			});
			return;
		}
		setIsLoading(true);
		setMessage(null);

		try {
			await sendEventAction({
				apiKey,
				email,
				eventName,
				eventProperties: {
					firstName: firstName || undefined,
					lastName: lastName || undefined,
				},
			});
			setMessage({ type: "success", text: `Event "${eventName}" sent!` });
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "Failed to send event",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleSendTransactional = async () => {
		if (!apiKey || !email || !transactionalId) {
			setMessage({
				type: "error",
				text: "Please enter API key, email, and transactional ID",
			});
			return;
		}
		setIsLoading(true);
		setMessage(null);

		try {
			await sendTransactionalAction({
				apiKey,
				email,
				transactionalId,
				dataVariables: {
					firstName: firstName || undefined,
					lastName: lastName || undefined,
				},
			});
			setMessage({ type: "success", text: "Transactional email sent!" });
		} catch (error) {
			setMessage({
				type: "error",
				text:
					error instanceof Error
						? error.message
						: "Failed to send transactional email",
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 w-full p-4">
			<div className="container mx-auto max-w-4xl">
				{/* Header */}
				<div className="text-center mb-6">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						Loops Component Demo
					</h1>
					<p className="text-gray-600 text-sm">
						Powered by Convex Components & Loops.so
					</p>
				</div>

				{/* API Key Section */}
				<div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
					<div className="flex items-center justify-between mb-2">
						<label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
							Loops API Key
						</label>
						<button
							type="button"
							onClick={() => setShowApiKey(!showApiKey)}
							className="text-xs text-blue-600 hover:text-blue-800"
						>
							{showApiKey ? "Hide" : "Show"}
						</button>
					</div>
					<div className="flex gap-2">
						<input
							id="apiKey"
							type={showApiKey ? "text" : "password"}
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
							placeholder="Enter your Loops API key"
						/>
						<button
							type="button"
							onClick={handleSaveApiKey}
							className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
						>
							Save
						</button>
						<button
							type="button"
							onClick={handleClearApiKey}
							className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
						>
							Clear
						</button>
					</div>
					<p className="text-xs text-gray-500 mt-1">
						Get your API key from{" "}
						<a
							href="https://app.loops.so/settings?page=api"
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-600 hover:underline"
						>
							Loops.so Settings
						</a>
					</p>
				</div>

				{/* Message Display */}
				{message && (
					<div
						className={`p-4 rounded-md mb-4 ${
							message.type === "success"
								? "bg-green-50 border border-green-200 text-green-800"
								: "bg-red-50 border border-red-200 text-red-800"
						}`}
					>
						{message.text}
					</div>
				)}

				{/* Tabs */}
				<div className="flex border-b border-gray-200 mb-4">
					{(
						["contacts", "events", "stats", "rate-limits"] as const
					).map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={`px-4 py-2 text-sm font-medium capitalize ${
								activeTab === tab
									? "border-b-2 border-blue-600 text-blue-600"
									: "text-gray-500 hover:text-gray-700"
							}`}
						>
							{tab.replace("-", " ")}
						</button>
					))}
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left Column - Forms */}
					<div className="bg-white rounded-lg shadow border border-gray-200 p-6">
						{activeTab === "contacts" && (
							<>
								<h2 className="text-lg font-semibold mb-4">
									Contact Management
								</h2>
								<form onSubmit={handleAddContact} className="space-y-3">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Email *
										</label>
										<input
											type="email"
											required
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											placeholder="user@example.com"
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												First Name
											</label>
											<input
												type="text"
												value={firstName}
												onChange={(e) => setFirstName(e.target.value)}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												placeholder="John"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												Last Name
											</label>
											<input
												type="text"
												value={lastName}
												onChange={(e) => setLastName(e.target.value)}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												placeholder="Doe"
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												User Group
											</label>
											<input
												type="text"
												value={userGroup}
												onChange={(e) => setUserGroup(e.target.value)}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												placeholder="premium"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												Source
											</label>
											<input
												type="text"
												value={source}
												onChange={(e) => setSource(e.target.value)}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												placeholder="website"
											/>
										</div>
									</div>

									<div className="flex gap-2 pt-2">
										<button
											type="submit"
											disabled={isLoading}
											className="flex-1 bg-blue-600 text-white font-medium px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
										>
											{isLoading ? "..." : "Add Contact"}
										</button>
										<button
											type="button"
											onClick={handleFindContact}
											disabled={isLoading}
											className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 disabled:opacity-50"
										>
											Find
										</button>
									</div>

									<div className="flex gap-2">
										<button
											type="button"
											onClick={handleUnsubscribe}
											disabled={isLoading}
											className="flex-1 px-4 py-2 bg-yellow-100 text-yellow-800 font-medium rounded-md hover:bg-yellow-200 disabled:opacity-50"
										>
											Unsubscribe
										</button>
										<button
											type="button"
											onClick={handleResubscribe}
											disabled={isLoading}
											className="flex-1 px-4 py-2 bg-green-100 text-green-800 font-medium rounded-md hover:bg-green-200 disabled:opacity-50"
										>
											Resubscribe
										</button>
										<button
											type="button"
											onClick={handleDeleteContact}
											disabled={isLoading}
											className="px-4 py-2 bg-red-100 text-red-800 font-medium rounded-md hover:bg-red-200 disabled:opacity-50"
										>
											Delete
										</button>
									</div>
								</form>
							</>
						)}

						{activeTab === "events" && (
							<>
								<h2 className="text-lg font-semibold mb-4">Send Events</h2>
								<div className="space-y-3">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Email *
										</label>
										<input
											type="email"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											placeholder="user@example.com"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Event Name *
										</label>
										<input
											type="text"
											value={eventName}
											onChange={(e) => setEventName(e.target.value)}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											placeholder="welcome"
										/>
									</div>
									<button
										type="button"
										onClick={handleSendEvent}
										disabled={isLoading}
										className="w-full bg-purple-600 text-white font-medium px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
									>
										{isLoading ? "Sending..." : "Send Event"}
									</button>

									<hr className="my-4" />

									<h3 className="font-medium text-gray-700">
										Transactional Email
									</h3>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Transactional ID *
										</label>
										<input
											type="text"
											value={transactionalId}
											onChange={(e) => setTransactionalId(e.target.value)}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
											placeholder="clxxxxxxxxx"
										/>
									</div>
									<button
										type="button"
										onClick={handleSendTransactional}
										disabled={isLoading}
										className="w-full bg-indigo-600 text-white font-medium px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
									>
										{isLoading ? "Sending..." : "Send Transactional"}
									</button>
								</div>
							</>
						)}

						{activeTab === "stats" && (
							<>
								<h2 className="text-lg font-semibold mb-4">
									Email Statistics (24h)
								</h2>
								{emailStats ? (
									<div className="space-y-3">
										<div className="grid grid-cols-2 gap-3">
											<div className="bg-blue-50 p-3 rounded-md">
												<div className="text-2xl font-bold text-blue-600">
													{emailStats.totalOperations}
												</div>
												<div className="text-sm text-gray-600">
													Total Operations
												</div>
											</div>
											<div className="bg-green-50 p-3 rounded-md">
												<div className="text-2xl font-bold text-green-600">
													{emailStats.successfulOperations}
												</div>
												<div className="text-sm text-gray-600">Successful</div>
											</div>
											<div className="bg-red-50 p-3 rounded-md">
												<div className="text-2xl font-bold text-red-600">
													{emailStats.failedOperations}
												</div>
												<div className="text-sm text-gray-600">Failed</div>
											</div>
											<div className="bg-purple-50 p-3 rounded-md">
												<div className="text-2xl font-bold text-purple-600">
													{emailStats.uniqueRecipients}
												</div>
												<div className="text-sm text-gray-600">
													Unique Recipients
												</div>
											</div>
										</div>
										{Object.keys(emailStats.operationsByType).length > 0 && (
											<div className="bg-gray-50 p-3 rounded-md">
												<div className="text-sm font-medium text-gray-700 mb-2">
													By Type
												</div>
												{Object.entries(emailStats.operationsByType).map(
													([type, count]) => (
														<div
															key={type}
															className="flex justify-between text-sm"
														>
															<span className="capitalize">{type}</span>
															<span className="font-medium">{count as number}</span>
														</div>
													),
												)}
											</div>
										)}
									</div>
								) : (
									<p className="text-gray-500">Loading stats...</p>
								)}
							</>
						)}

						{activeTab === "rate-limits" && (
							<>
								<h2 className="text-lg font-semibold mb-4">
									Spam Detection (1h)
								</h2>
								{recipientSpam ? (
									<div>
										{recipientSpam.length > 0 ? (
											<div className="space-y-2">
												{recipientSpam.map((item, i) => (
													<div
														key={i}
														className="bg-red-50 p-3 rounded-md border border-red-200"
													>
														<div className="font-medium text-red-800">
															{item.email}
														</div>
														<div className="text-sm text-red-600">
															{item.count} emails in window
														</div>
													</div>
												))}
											</div>
										) : (
											<div className="bg-green-50 p-4 rounded-md border border-green-200">
												<p className="text-green-800">
													No spam patterns detected
												</p>
											</div>
										)}
									</div>
								) : (
									<p className="text-gray-500">Loading spam detection...</p>
								)}
							</>
						)}
					</div>

					{/* Right Column - Live Data */}
					<div className="bg-white rounded-lg shadow border border-gray-200 p-6">
						<h2 className="text-lg font-semibold mb-4">Live Database</h2>

						<div className="bg-gray-50 p-4 rounded-md mb-4">
							<div className="text-3xl font-bold text-gray-900">
								{contactCount ?? "..."}
							</div>
							<div className="text-sm text-gray-600">Total Contacts</div>
						</div>

						<div className="text-sm text-gray-500">
							<p className="mb-2">
								This data is synced from the component's local database, updated
								in real-time as contacts are added/removed via the Loops API.
							</p>
							<p>
								The aggregate counting uses O(log n) efficiency for fast counts
								even with millions of contacts.
							</p>
						</div>

						<div className="mt-4 p-4 bg-blue-50 rounded-md border border-blue-100">
							<h3 className="font-medium text-blue-800 mb-2">Features Demo</h3>
							<ul className="text-sm text-blue-700 space-y-1">
								<li>- Cursor-based pagination</li>
								<li>- Aggregate counting (O(log n))</li>
								<li>- Rate limiting queries</li>
								<li>- Spam detection</li>
								<li>- Email statistics</li>
							</ul>
						</div>

						<div className="mt-4 p-4 bg-gray-100 rounded-md">
							<code className="text-xs text-gray-600 font-mono">
								example/convex/example.ts
							</code>
							<p className="text-xs text-gray-500 mt-1">
								Check out the code to see all available features
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
