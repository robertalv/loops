import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import "./index.css";

export function App() {
	const [email, setEmail] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const addContact = useAction(api.example.addContact);
	const sendEvent = useAction(api.example.sendEvent);
	const [isLoading, setIsLoading] = useState(false);

	const handleAddContact = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setMessage(null);

		try {
			await addContact({
				email,
				firstName: firstName || undefined,
				lastName: lastName || undefined,
			});
			setMessage({ type: "success", text: "Contact added successfully!" });
			setEmail("");
			setFirstName("");
			setLastName("");
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "Failed to add contact",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleSendEvent = async () => {
		if (!email) {
			setMessage({ type: "error", text: "Please enter an email first" });
			return;
		}

		setIsLoading(true);
		setMessage(null);

		try {
			await sendEvent({
				email,
				eventName: "welcome",
				eventProperties: {
					firstName: firstName || undefined,
					lastName: lastName || undefined,
				},
			});
			setMessage({ type: "success", text: "Event sent successfully!" });
		} catch (error) {
			setMessage({
				type: "error",
				text: error instanceof Error ? error.message : "Failed to send event",
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 w-full flex items-center justify-center p-4">
			<div className="container mx-auto max-w-md">
				<div className="bg-white rounded-lg shadow border border-gray-200 p-8">
					<div className="text-center mb-8">
						<h1 className="text-3xl font-bold text-gray-900 mb-2">
							Loops Component
						</h1>
						<p className="text-gray-600 text-sm">
							Powered by Convex Components & Loops.so
						</p>
					</div>

					<form onSubmit={handleAddContact} className="space-y-4 mb-6">
						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Email *
							</label>
							<input
								id="email"
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="user@example.com"
							/>
						</div>

						<div>
							<label
								htmlFor="firstName"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								First Name
							</label>
							<input
								id="firstName"
								type="text"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="John"
							/>
						</div>

						<div>
							<label
								htmlFor="lastName"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Last Name
							</label>
							<input
								id="lastName"
								type="text"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Doe"
							/>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full bg-blue-600 text-white font-medium px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? "Adding..." : "Add Contact"}
						</button>
					</form>

					<div className="mb-6">
						<button
							type="button"
							onClick={handleSendEvent}
							disabled={isLoading || !email}
							className="w-full bg-green-600 text-white font-medium px-6 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Send Welcome Event
						</button>
					</div>

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

					<div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
						<p className="text-sm text-gray-700 text-center">
							<code className="text-blue-600 font-mono text-xs">
								example/convex/example.ts
							</code>
							<br />
							<span className="text-gray-500 text-xs">
								Check out the code to see all available features
							</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
